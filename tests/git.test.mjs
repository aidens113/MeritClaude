// Branch automation and the git checkpoint hook, against throwaway repositories with a local
// bare repository as origin.   node --test tests/git.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = join(REPO, 'tools', 'branch.mjs');
const CHECKPOINT = join(REPO, 'hooks', 'git-checkpoint.mjs');

function sh(cwd, cmd, args) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}`.trim() };
}
const git = (cwd, ...args) => {
  const r = sh(cwd, 'git', args);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.out}`);
  return r.out;
};
const branch = (cwd, ...args) => sh(cwd, process.execPath, [BRANCH, ...args]);

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'meritclaude-git-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  git(root, 'init', '--bare', '-b', 'main', origin);
  git(root, 'init', '-b', 'main', work);
  for (const [k, v] of [['user.name', 'Test'], ['user.email', 'test@example.com'], ['core.autocrlf', 'false']]) git(work, 'config', k, v);
  git(work, 'remote', 'add', 'origin', origin);
  writeFileSync(join(work, 'a.txt'), 'one\n');
  git(work, 'add', '.');
  git(work, 'commit', '-m', 'initial');
  return { work, origin };
}
const commit = (cwd, file, text, msg) => { writeFileSync(join(cwd, file), text); git(cwd, 'add', file); git(cwd, 'commit', '-m', msg); };
const remoteBranches = (origin) => git(origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split(/\r?\n/).sort();

test('branch.mjs: init, start, finish into the parent, promote to main', () => {
  const { work, origin } = fixture();
  assert.equal(branch(work, 'init').status, 0);
  assert.deepEqual(remoteBranches(origin), ['dev', 'main']);

  assert.equal(branch(work, 'start', 'feat/login').status, 0);
  assert.equal(git(work, 'config', '--get', 'branch.feat/login.meritParent'), 'dev');
  commit(work, 'login.txt', 'login\n', 'add login');
  git(work, 'push', '-u', 'origin', 'feat/login');

  const done = branch(work, 'finish', '--check', 'node -e "process.exit(0)"', '--title', 'Login form');
  assert.equal(done.status, 0, done.out);
  assert.equal(git(work, 'branch', '--show-current'), 'dev');
  assert.match(git(work, 'log', '-1', '--format=%s', 'dev'), /^Merge feat\/login: Login form$/);
  assert.equal(git(work, 'rev-list', '--count', 'origin/dev..dev'), '0', 'dev pushed');
  assert.deepEqual(remoteBranches(origin), ['dev', 'main'], 'merged branch deleted on origin');
  assert.equal(sh(work, 'git', ['rev-parse', '--verify', 'feat/login']).status, 128, 'merged branch deleted locally');

  const promoted = branch(work, 'promote');
  assert.equal(promoted.status, 0, promoted.out);
  assert.equal(git(work, 'rev-parse', 'main'), git(work, 'rev-parse', 'dev'));
  assert.equal(git(origin, 'rev-parse', 'main'), git(work, 'rev-parse', 'dev'));
});

test('branch.mjs: nested feature merges into its parent feature, and children re-parent', () => {
  const { work } = fixture();
  branch(work, 'init');
  branch(work, 'start', 'feat/epic');
  commit(work, 'epic.txt', 'epic\n', 'epic base');
  assert.equal(branch(work, 'start', 'feat/epic--part', '--parent', 'feat/epic').status, 0);
  commit(work, 'part.txt', 'part\n', 'part');
  git(work, 'switch', 'feat/epic');
  branch(work, 'start', 'feat/epic--later', '--parent', 'feat/epic');
  git(work, 'switch', 'feat/epic--part');
  assert.equal(branch(work, 'finish').status, 0);
  assert.equal(git(work, 'branch', '--show-current'), 'feat/epic');
  assert.match(git(work, 'log', '-1', '--format=%s'), /^Merge feat\/epic--part/);
  assert.equal(branch(work, 'finish').status, 0);
  assert.equal(git(work, 'branch', '--show-current'), 'dev');
  assert.equal(git(work, 'config', '--get', 'branch.feat/epic--later.meritParent'), 'dev', 'grandchild re-parented');
});

test('branch.mjs: a failing check or a conflict leaves both branches untouched', () => {
  const { work } = fixture();
  branch(work, 'init');
  branch(work, 'start', 'feat/bad');
  commit(work, 'a.txt', 'feature\n', 'feature edit');
  const devBefore = git(work, 'rev-parse', 'dev');

  const failed = branch(work, 'finish', '--check', 'node -e "process.exit(3)"');
  assert.equal(failed.status, 1);
  assert.match(failed.out, /Check failed on feat\/bad/);
  assert.equal(git(work, 'rev-parse', 'dev'), devBefore);
  assert.equal(git(work, 'branch', '--show-current'), 'feat/bad');

  git(work, 'switch', 'dev');
  commit(work, 'a.txt', 'dev\n', 'dev edit');
  git(work, 'switch', 'feat/bad');
  const conflicted = branch(work, 'finish');
  assert.equal(conflicted.status, 1);
  assert.match(conflicted.out, /conflicts; merge aborted[\s\S]*a\.txt/);
  assert.equal(git(work, 'status', '--porcelain'), '');
  assert.equal(git(work, 'branch', '--show-current'), 'feat/bad');

  writeFileSync(join(work, 'a.txt'), 'dirty\n');
  assert.match(branch(work, 'finish').out, /Uncommitted changes/);
  assert.match(branch(work, 'promote').out, /Uncommitted changes/);
});

test('branch.mjs: promote merges a main hotfix back into dev before fast-forwarding', () => {
  const { work } = fixture();
  branch(work, 'init');
  branch(work, 'start', 'fix/urgent', '--parent', 'main');
  commit(work, 'fix.txt', 'fix\n', 'hotfix');
  assert.equal(branch(work, 'finish').status, 0);
  git(work, 'switch', 'dev');
  commit(work, 'dev.txt', 'dev\n', 'dev work');
  const r = branch(work, 'promote');
  assert.equal(r.status, 0, r.out);
  assert.equal(git(work, 'rev-parse', 'main'), git(work, 'rev-parse', 'dev'));
  assert.equal(git(work, 'branch', '--show-current'), 'dev');
});

test('branch.mjs: concurrent workstreams in worktrees finish from the main checkout', () => {
  const { work, origin } = fixture();
  branch(work, 'init');
  for (const name of ['feat/api', 'feat/ui']) {
    const r = branch(work, 'start', name, '--worktree');
    assert.equal(r.status, 0, r.out);
  }
  assert.equal(git(work, 'branch', '--show-current'), 'dev', 'main checkout untouched');
  assert.equal(git(work, 'status', '--porcelain'), '', 'worktree folder is excluded, not untracked');
  const apiTree = join(work, '.claude', 'worktrees', 'feat-api');
  const uiTree = join(work, '.claude', 'worktrees', 'feat-ui');
  commit(apiTree, 'api.txt', 'api\n', 'api');
  commit(uiTree, 'ui.txt', 'ui\n', 'ui');

  for (const name of ['feat/api', 'feat/ui']) {
    const r = branch(work, 'finish', name, '--check', 'node -e "process.exit(0)"');
    assert.equal(r.status, 0, r.out);
  }
  assert.equal(git(work, 'branch', '--show-current'), 'dev');
  assert.match(git(work, 'log', '--format=%s', '-3', 'dev'), /Merge feat\/ui[\s\S]*Merge feat\/api/);
  assert.equal(git(work, 'worktree', 'list').split(/\r?\n/).length, 1, 'worktrees removed');
  assert.deepEqual(remoteBranches(origin), ['dev', 'main']);
  assert.match(git(work, 'ls-tree', '--name-only', 'dev'), /api\.txt[\s\S]*ui\.txt/);
});

test('promote publishes opted-in packages with a new version, tags them, and reports failures', () => {
  const { work, origin } = fixture();
  const registry = join(dirname(work), 'registry.json');
  const env = (extra = {}) => ({ ...process.env, MERIT_NPM_CMD: `node "${join(REPO, 'tests', 'fixtures', 'fake-npm.mjs')}"`, FAKE_REGISTRY: registry, ...extra });
  const run = (extra, ...args) => {
    const r = spawnSync(process.execPath, [BRANCH, ...args], { cwd: work, encoding: 'utf8', env: env(extra) });
    return { status: r.status, out: `${r.stdout}${r.stderr}`.trim() };
  };
  const pkg = (path, json) => { mkdirSync(join(work, path), { recursive: true }); writeFileSync(join(work, path, 'package.json'), JSON.stringify(json)); };
  const published = () => (existsSync(registry) ? JSON.parse(readFileSync(registry, 'utf8')) : []);

  branch(work, 'init');
  pkg('.', { name: 'root', version: '1.0.0' });
  pkg('packages/lib', { name: '@t/lib', version: '1.0.0', publishConfig: { access: 'public' } });
  pkg('packages/app', { name: 'app', version: '1.0.0', private: true, publishConfig: {} });
  git(work, 'add', '.');
  git(work, 'commit', '-m', 'packages');

  const first = run({}, 'promote');
  assert.equal(first.status, 0, first.out);
  assert.deepEqual(published(), ['@t/lib@1.0.0'], 'only the opted-in, non-private package');
  assert.match(git(origin, 'tag'), /@t\/lib@1\.0\.0/);
  assert.equal(git(work, 'branch', '--show-current'), 'dev');

  assert.match(run({}, 'promote').out, /@t\/lib@1\.0\.0 already on the registry; skipped/);
  assert.match(run({}, 'publish').out, /from main only/, 'manual publish refuses non-main');

  pkg('packages/lib', { name: '@t/lib', version: '1.1.0', publishConfig: { access: 'public' } });
  git(work, 'commit', '-am', 'bump lib');
  assert.match(run({}, 'publish', '--dry-run').out, /would publish @t\/lib@1\.1\.0/);
  const down = run({ FAKE_DOWN: '1' }, 'promote');
  assert.equal(down.status, 1);
  assert.match(down.out, /could not query the registry[\s\S]*publishing failed for: @t\/lib@1\.1\.0/);
  assert.equal(git(origin, 'rev-parse', 'main'), git(work, 'rev-parse', 'dev'), 'main still promoted');
  const denied = run({ FAKE_FAIL: '@t/lib' }, 'publish');
  assert.equal(denied.status, 1, 'publish from dev refused');
  git(work, 'switch', 'main');
  const failed = run({ FAKE_FAIL: '@t/lib' }, 'publish');
  assert.match(failed.out, /E403[\s\S]*Publishing failed for: @t\/lib@1\.1\.0/);
  assert.equal(run({}, 'publish').status, 0);
  assert.deepEqual(published(), ['@t/lib@1.0.0', '@t/lib@1.1.0']);
});

test('git-checkpoint: nags once about new uncommitted or unpushed work, never about pre-existing changes', () => {
  const { work } = fixture();
  branch(work, 'init');
  writeFileSync(join(work, 'user-wip.txt'), 'user\n');
  const session = `s${Date.now()}`;
  const hook = (event, extra = {}) => {
    const r = spawnSync(process.execPath, [CHECKPOINT], { input: JSON.stringify({ hook_event_name: event, session_id: session, cwd: work, ...extra }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  assert.match(hook('SessionStart'), /^Git \(automatic management on\): dev \(parent main\), pushed, tree 1 uncommitted/);
  assert.equal(hook('Stop'), '', 'pre-existing user changes do not nag');

  writeFileSync(join(work, 'a.txt'), 'agent edit\n');
  const nag = JSON.parse(hook('Stop'));
  assert.equal(nag.decision, 'block');
  assert.match(nag.reason, /uncommitted: .*a\.txt/);
  assert.equal(hook('Stop'), '', 'same state never blocks twice');
  assert.equal(hook('Stop', { stop_hook_active: true }), '');

  git(work, 'add', 'a.txt');
  git(work, 'commit', '-m', 'agent');
  assert.match(JSON.parse(hook('Stop')).reason, /1 commit\(s\) not pushed/);
  assert.equal(hook('Stop', { agent_type: 'worker' }), '', 'subagents are not checked');

  git(work, 'config', 'merit.auto', 'false');
  writeFileSync(join(work, 'a.txt'), 'another\n');
  assert.equal(hook('Stop'), '', 'opt-out respected');
  assert.equal(hook('SessionStart'), '');
});

test('git-checkpoint: a pre-existing dirty file untouched by the session is not reported after a commit', () => {
  const { work } = fixture();
  branch(work, 'init');
  writeFileSync(join(work, 'user-wip.txt'), 'user\n');
  const session = `p${Date.now()}`;
  const hook = (event) => {
    const r = spawnSync(process.execPath, [CHECKPOINT], { input: JSON.stringify({ hook_event_name: event, session_id: session, cwd: work }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  hook('SessionStart');
  writeFileSync(join(work, 'a.txt'), 'agent\n');
  git(work, 'add', 'a.txt');
  git(work, 'commit', '-m', 'agent');
  const first = JSON.parse(hook('Stop'));
  assert.match(first.reason, /1 commit\(s\) not pushed/);
  assert.doesNotMatch(first.reason, /uncommitted/, 'pre-existing file is not listed');
  git(work, 'push');
  assert.equal(hook('Stop'), '', 'only the pre-existing file remains dirty');

  writeFileSync(join(work, 'user-wip.txt'), 'user, then agent\n');
  assert.match(JSON.parse(hook('Stop')).reason, /uncommitted: user-wip\.txt/, 'modified during the session is reported');
  writeFileSync(join(work, 'new.txt'), 'new\n');
  assert.match(JSON.parse(hook('Stop')).reason, /uncommitted: .*new\.txt/, 'new file is reported');
});
