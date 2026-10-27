// Runs each hook as Claude Code does: a node process with the hook JSON on stdin.
//   node --test tests/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = () => mkdtempSync(join(tmpdir(), 'meritclaude-test-'));

function run(script, input, env = {}) {
  const r = spawnSync(process.execPath, [join(REPO, script), ...(input.argv ?? [])], {
    input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '', 'hook wrote to stderr');
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}
const decision = (out) => out?.hookSpecificOutput?.permissionDecision ?? 'allow';
const bash = (command, agent_type) => ({ tool_name: 'Bash', tool_input: { command }, ...(agent_type && { agent_type }) });

test('git-guard: subagents get read-only git only', () => {
  const allow = ['git status && git diff --stat', 'git log --oneline -5 | head', 'git branch', 'git branch -a',
    'git stash list', 'git -C D:/x show HEAD', 'git remote -v', 'git worktree list', 'git config --get user.name',
    'npm test', 'gitk', 'echo done', 'git tag', 'node D:/MeritClaude/tools/branch.mjs status'];
  for (const c of allow) assert.equal(decision(run('hooks/git-guard.mjs', bash(c, 'worker'))), 'allow', c);
  const deny = ['git commit -m x', 'git status && git commit -m x', 'git -C D:/x push', 'git add .', 'git stash',
    'git checkout main', 'git switch dev', 'git reset --hard', 'git branch -D x', 'git branch feat/x',
    'bash -c "git commit -m \'msg\'"', 'cd x; git push origin dev', 'git.exe merge dev', 'git tag v1',
    'git worktree add ../x', 'git restore .', 'git clean -fd', 'git rebase dev',
    'node D:/MeritClaude/tools/branch.mjs finish --check "npm test"', 'node tools/branch.mjs start feat/x'];
  for (const c of deny) assert.equal(decision(run('hooks/git-guard.mjs', bash(c, 'supervisor'))), 'deny', c);
});

test('git-guard: lead may commit and push, but not bypass hooks or force-push silently', () => {
  for (const c of ['git commit -m "x"', 'git push origin dev', 'git merge --no-ff feat/x', 'git checkout dev']) {
    assert.equal(decision(run('hooks/git-guard.mjs', bash(c))), 'allow', c);
  }
  for (const c of ['git commit --no-verify -m x', 'git commit -n -m x', 'git push --no-verify']) {
    assert.equal(decision(run('hooks/git-guard.mjs', bash(c))), 'deny', c);
  }
  for (const c of ['git push --force origin dev', 'git push -f', 'git push origin +dev', 'git push --force-with-lease',
    'git push origin --delete feat/x', 'git push origin :feat/x', 'git filter-repo --path x']) {
    assert.equal(decision(run('hooks/git-guard.mjs', bash(c))), 'ask', c);
  }
});

test('git-guard: registry writes go through promote', () => {
  const check = (c, who) => decision(run('hooks/git-guard.mjs', bash(c, who)));
  for (const c of ['npm publish', 'pnpm publish --no-git-checks', 'cd packages/x && npm publish --access public',
    'node D:/MeritClaude/tools/branch.mjs publish', 'npm unpublish x@1.0.0', 'yarn npm publish']) {
    assert.equal(check(c, 'worker'), 'deny', c);
  }
  assert.equal(check('npm publish --dry-run', 'worker'), 'allow');
  assert.equal(check('npm install && npm test', 'worker'), 'allow');
  assert.equal(check('npm publish'), 'ask');
  assert.equal(check('npm deprecate x@1 "old"'), 'ask');
  assert.equal(check('npm dist-tag add x@1.0.0 latest'), 'ask');
  assert.equal(check('npm dist-tag ls x'), 'allow');
  assert.equal(check('node D:/MeritClaude/tools/branch.mjs publish'), 'allow');
  assert.equal(check('node D:/MeritClaude/tools/branch.mjs promote --check "npm test"'), 'allow');
});

test('agent-guard: routing and hierarchy', () => {
  const agent = (tool_input, agent_type) => decision(run('hooks/agent-guard.mjs', { tool_name: 'Agent', tool_input, ...(agent_type && { agent_type }) }));
  assert.equal(agent({ subagent_type: 'Explore', prompt: 'x' }), 'deny');
  assert.equal(agent({ prompt: 'x' }), 'deny', 'omitted type is general-purpose');
  assert.equal(agent({ subagent_type: 'Explore', model: 'haiku' }), 'allow');
  assert.equal(agent({ subagent_type: 'worker' }), 'allow');
  assert.equal(agent({ subagent_type: 'supervisor' }), 'allow');
  assert.equal(agent({ subagent_type: 'worker-light' }, 'supervisor'), 'allow');
  assert.equal(agent({ subagent_type: 'supervisor' }, 'supervisor'), 'deny');
  assert.equal(agent({ subagent_type: 'worker' }, 'worker'), 'deny');
  assert.equal(agent({ subagent_type: 'worker-heavy', model: 'fable' }), 'ask');
  assert.equal(agent({ subagent_type: 'general-purpose', model: 'claude-fable-5-1' }), 'ask');
  assert.equal(agent({ subagent_type: 'claude-code-guide' }), 'allow', 'agents with their own definition pass');
});

test('report-guard: sends a worker back once when the return contract is missing', () => {
  const id = `t${Date.now()}`;
  const stop = (extra) => run('hooks/report-guard.mjs', { hook_event_name: 'SubagentStop', agent_id: id, ...extra });
  assert.equal(stop({ agent_type: 'general-purpose', last_assistant_message: 'done' }), null);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'Outcome: Done\nChanged: a.ts\nReport: inline' }), null);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: '```text\nOutcome: Partial\nReport: "inline"\n```' }), null);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'All done!', stop_hook_active: true }), null);
  const out = stop({ agent_type: 'worker', last_assistant_message: 'All done!' });
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /no return contract; no Report: line/);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'Still no contract' }), null, 'second stop is allowed');
});

test('report-guard: the Report line must name a file that exists', () => {
  const cwd = tmp();
  mkdirSync(join(cwd, 'reports'));
  writeFileSync(join(cwd, 'reports', 'hooks.md'), '# Report\n');
  let n = 0;
  const stop = (message, agent_type = 'worker') => run('hooks/report-guard.mjs', {
    hook_event_name: 'SubagentStop', agent_id: `r${Date.now()}-${n++}`, agent_type, cwd, last_assistant_message: message,
  });
  for (const claimed of ['reports/hooks.md', '`reports/hooks.md`', join(cwd, 'reports', 'hooks.md'), '<reports/hooks.md>']) {
    assert.equal(stop(`Outcome: Done\nChanged: x\nReport: ${claimed}\nNotes: none`), null, claimed);
  }
  assert.equal(stop('Outcome: Done\n**Report**: reports/hooks.md'), null, 'bold label');
  const missing = stop('Outcome: Done\nReport: reports/never-written.md', 'supervisor');
  assert.equal(missing.decision, 'block');
  assert.ok(missing.reason.includes(join(cwd, 'reports', 'never-written.md')), missing.reason);
  assert.equal(stop('Outcome: Done\nChanged: x').decision, 'block', 'no Report line');
  assert.equal(stop('Outcome: Done\nReport: <path from the brief>', 'worker-light').decision, 'block', 'placeholder left in');
  assert.equal(stop('Outcome: Done\nReport: reports', 'worker-heavy').decision, 'block', 'a directory is not a report');
});

test('report-guard: falls back to the transcript when last_assistant_message is absent', () => {
  const dir = tmp();
  const transcript = join(dir, 'agent.jsonl');
  writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'finished' }] } })}\n`);
  const out = run('hooks/report-guard.mjs', { agent_type: 'worker-heavy', agent_id: `f${Date.now()}`, agent_transcript_path: transcript });
  assert.equal(out.decision, 'block');
});

test('usage-ledger: records models and deduplicated token totals', () => {
  const dir = tmp();
  const transcript = join(dir, 'agent-abc.jsonl');
  const msg = (id, model, output, text = '') => JSON.stringify({ type: 'assistant', message: { id, model, content: [{ type: 'text', text }], usage: { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: output } } });
  writeFileSync(transcript, [msg('m1', 'claude-haiku-4-5-20251001', 1), msg('m1', 'claude-haiku-4-5-20251001', 7, 'x'.repeat(400)),
    msg('m2', 'claude-haiku-4-5-20251001', 3), '{"type":"user"}', '{"partial'].join('\n'));
  writeFileSync(join(dir, 'agent-abc.meta.json'), JSON.stringify({ agentType: 'worker-light', spawnDepth: 2, description: 'probe' }));
  const log = join(dir, 'usage.ndjson');
  run('hooks/usage-ledger.mjs', { agent_id: 'abc', agent_type: 'worker-light', session_id: 's', cwd: 'D:/x', agent_transcript_path: transcript }, { MERIT_USAGE_LOG: log });
  const entry = JSON.parse(readFileSync(log, 'utf8'));
  assert.equal(entry.spawn_depth, 2);
  assert.deepEqual(entry.models['claude-haiku-4-5-20251001'], { requests: 2, input: 4, cache_write: 20, cache_read: 200, output_est: 103 });
  const report = spawnSync(process.execPath, [join(REPO, 'tools/usage-report.mjs'), '--log', log], { encoding: 'utf8' });
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /claude-haiku-4-5-20251001/);
});

const FIXTURES = join(REPO, 'tests', 'fixtures');
const gitIn = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
function gitRepo() {
  const dir = tmp();
  gitIn(dir, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.name', 'Test'], ['user.email', 'test@example.com'], ['core.autocrlf', 'false']]) gitIn(dir, 'config', k, v);
  return dir;
}
function workingDir(dir, indexFixture) {
  mkdirSync(join(dir, 'docs', 'working'), { recursive: true });
  if (indexFixture) copyFileSync(join(FIXTURES, indexFixture), join(dir, 'docs', 'working', 'README.md'));
  return join(dir, 'docs', 'working');
}
const sessionContext = (cwd) => {
  const r = spawnSync(process.execPath, [join(REPO, 'hooks/session-context.mjs')], { input: JSON.stringify({ cwd }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  return r.stdout;
};

test('session-context: status-column index lists Active and Blocked working documents only', () => {
  const dir = tmp();
  const working = workingDir(dir, 'working-index-status-column.md');
  writeFileSync(join(working, 'handoff.md'), '# Handoff\n');
  const out = sessionContext(dir);
  assert.match(out, /handoff\.md/);
  assert.match(out, /Active: alpha\.md: Build the alpha widget/);
  assert.match(out, /Blocked: gamma\.md: Waiting on gamma credentials/);
  assert.doesNotMatch(out, /beta\.md/);
  assert.match(out, /Run \/resume <document>/);
  assert.doesNotMatch(out, /Uncommitted/, 'not a git repository');
});

test('session-context: section-heading index finds Scope by header name, plus uncommitted documents', () => {
  const dir = gitRepo();
  workingDir(dir, 'working-index-sections.md');
  gitIn(dir, 'add', '.');
  gitIn(dir, 'commit', '-q', '-m', 'index');
  writeFileSync(join(dir, 'docs', 'working', 'draft plan.md'), 'draft\n');
  writeFileSync(join(dir, 'outside.txt'), 'not a working document\n');
  const out = sessionContext(dir);
  assert.match(out, /Active: orchard-plan\.md: Plant the orchard rows\n/);
  assert.match(out, /Active: kiln-repair\.md: Repair the kiln door\n/);
  assert.match(out, /Blocked: harbor-survey\.md: Survey waits on tide tables\n/);
  assert.doesNotMatch(out, /old-bridge|Document|lead|120/, 'Complete section, header rows and other columns are skipped');
  assert.match(out, /Uncommitted working documents \(1\): docs\/working\/draft plan\.md/);
  assert.doesNotMatch(out, /outside\.txt/);
  assert.match(out.trim().split('\n').at(-1), /Run \/resume <document>/);
});

test('session-context: capped at 15 lines, and silent outside docs/working', () => {
  const dir = tmp();
  const working = workingDir(dir);
  writeFileSync(join(working, 'handoff.md'), '# Handoff\n');
  const rows = Array.from({ length: 30 }, (_, i) => `| [d${i}.md](d${i}.md) | Active | Scope ${i} ${'x'.repeat(200)} |`);
  writeFileSync(join(working, 'README.md'), ['| Document | Status | Scope |', '| --- | --- | --- |', ...rows].join('\n'));
  const lines = sessionContext(dir).trim().split('\n');
  assert.equal(lines.length, 15, lines.join('\n'));
  assert.match(lines.at(-2), /…and 19 more in docs\/working\/README\.md/);
  assert.ok(lines.every((l) => l.length < 200), 'scopes are truncated');
  assert.equal(sessionContext(tmp()), '', 'no docs/working');
  const bare = tmp();
  workingDir(bare);
  assert.equal(sessionContext(bare), '', 'docs/working with nothing to report');
});

test('git-checkpoint: one Stop output: /handoff joins the send-back, notes only when not sending back', () => {
  const dir = gitRepo();
  workingDir(dir, 'working-index-status-column.md');
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  gitIn(dir, 'add', '.');
  gitIn(dir, 'commit', '-q', '-m', 'initial');
  const session = `h${Date.now()}`;
  const start = spawnSync(process.execPath, [join(REPO, 'hooks/git-checkpoint.mjs')], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: session, cwd: dir }), encoding: 'utf8' });
  assert.equal(start.status, 0, start.stderr);
  const stop = (extra = {}) => run('hooks/git-checkpoint.mjs', { hook_event_name: 'Stop', session_id: session, cwd: dir, ...extra });
  const footer = 'Git: committed and pushed dev\nNext: /clear, then /resume alpha';

  assert.deepEqual(stop({ last_assistant_message: footer }), { systemMessage: CLEAR_TEXT }, 'clean tree after handoff');
  assert.equal(stop({ last_assistant_message: 'Running tests next; /clear is unrelated.' }), null);

  writeFileSync(join(dir, 'docs', 'working', 'plan.md'), 'draft\n');
  writeFileSync(join(dir, 'a.txt'), 'two\n');
  const nag = stop({ last_assistant_message: footer });
  assert.equal(nag.decision, 'block');
  assert.equal(nag.systemMessage, undefined, 'a send-back never also suggests /clear');
  assert.match(nag.reason, /working documents: docs\/working\/plan\.md\. Run \/handoff/);
  assert.match(nag.reason, /uncommitted: .*a\.txt/);
  assert.equal(stop(), null, 'same state never blocks twice');
  assert.equal(stop({ last_assistant_message: footer, stop_hook_active: true }), null);

  gitIn(dir, 'config', 'merit.auto', 'false');
  const note = stop({ last_assistant_message: footer });
  assert.equal(note.decision, undefined, 'opt-out never sends back');
  assert.match(note.systemMessage, /^Uncommitted working documents: docs\/working\/plan\.md\. Run \/handoff/);
  assert.match(note.systemMessage, /Clear the message history now\?/);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: footer }), null, 'subagents are not checked');
});
const CLEAR_TEXT = 'Unit handed off. Clear the message history now? Type /clear to start the next task clean; '
  + 'docs/working holds the state and /resume picks it up. Carry on instead if this task continues.';

test('instruction-metrics: records size and load reason, never content', () => {
  const dir = tmp();
  const log = join(dir, 'nested', 'instructions.ndjson');
  const load = (extra) => run('hooks/instruction-metrics.mjs', { hook_event_name: 'InstructionsLoaded', session_id: 's1', cwd: 'D:/x', ...extra }, { MERIT_INSTRUCTIONS_LOG: log });
  assert.equal(load({ file_path: 'D:/x/CLAUDE.md', memory_type: 'Project', load_reason: 'session_start', content: 'SECRET-MARKER é\n' }), null);
  const onDisk = join(dir, 'AGENTS.md');
  writeFileSync(onDisk, '0123456789\n');
  load({ file_path: onDisk, load_reason: 'include', parent_file_path: 'D:/x/CLAUDE.md' });
  load({ load_reason: 'session_start' });
  load({ hook_event_name: 'Stop', file_path: 'D:/x/CLAUDE.md' });
  const text = readFileSync(log, 'utf8');
  assert.doesNotMatch(text, /SECRET-MARKER/);
  const [first, second, ...rest] = text.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(rest.length, 0, 'no file_path or another event writes nothing');
  assert.equal(first.bytes, Buffer.byteLength('SECRET-MARKER é\n'));
  assert.equal(first.memory_type, 'Project');
  assert.equal(first.load_reason, 'session_start');
  assert.match(first.time, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(second.bytes, 11, 'falls back to the size on disk');
  assert.equal(second.parent_file_path, 'D:/x/CLAUDE.md');
  assert.ok(!existsSync(join(dir, 'other.ndjson')));
});

test('git-guard: ported worker rules: heredocs, gh pr writes, substitutions, agent_id', () => {
  const check = (command, agent_type, extra = {}) => decision(run('hooks/git-guard.mjs', { ...bash(command, agent_type), ...extra }));
  const report = "mkdir -p r && cat > r/x.md <<'EOF'\n# Report\nThe attempt `git commit -m x` was denied.\ngit push origin dev\nEOF";
  assert.equal(check(report, 'worker'), 'allow', 'a heredoc body is data');
  assert.equal(check('cat > n.md <<EOF\ngit commit is quoted\nEOF\ngit push origin dev', 'worker'), 'deny', 'a write after the heredoc');
  assert.equal(check("bash <<'EOF'\ngit push origin dev\nEOF", 'worker'), 'deny', 'a body fed to a shell runs');
  assert.equal(check('git commit -F - <<EOF\nmessage\nEOF', 'worker'), 'deny', 'the opening line is still a command');
  assert.equal(check('git commit -F - <<EOF\nmessage\nEOF'), 'allow', 'the lead commits with a heredoc message');
  for (const c of ['gh pr create --fill', 'gh pr merge 12 --squash', 'npm test && gh pr create -t x', 'gh.exe pr merge 3']) {
    assert.equal(check(c, 'worker-light'), 'deny', c);
  }
  for (const c of ['gh pr view 12', 'gh pr list', 'gh issue create -t x', 'echo ghost pr create']) assert.equal(check(c, 'worker'), 'allow', c);
  assert.equal(check('gh pr create --fill'), 'allow', 'the lead opens pull requests');
  for (const c of ['echo $(git commit -m x)', 'x=`git push`', 'git.cmd push', '{ git commit -m x; }']) assert.equal(check(c, 'worker'), 'deny', c);
  assert.equal(check('git commit -m x', undefined, { agent_id: 'a1' }), 'deny', 'agent_id alone marks a subagent');
  assert.equal(decision(run('hooks/git-guard.mjs', { tool_name: 'PowerShell', agent_type: 'worker',
    tool_input: { command: '& "C:\\Program Files\\Git\\cmd\\git.exe" commit -m x' } })), 'deny');
});

test('bin/meritclaude: lists commands and forwards to them', () => {
  const cli = (...a) => spawnSync(process.execPath, [join(REPO, 'bin', 'meritclaude.mjs'), ...a], { encoding: 'utf8' });
  const help = cli();
  assert.equal(help.status, 0);
  assert.match(help.stdout, /install[\s\S]*branch[\s\S]*usage/);
  assert.equal(cli('nope').status, 1);
  const dry = cli('install', '--home', tmp());
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Dry run/);
});

test('install: replaces retired hooks, keeps user settings, and is idempotent', () => {
  const home = tmp();
  writeFileSync(join(home, 'settings.json'), JSON.stringify({
    env: { CLAUDE_CODE_SUBAGENT_MODEL: 'opus', OTHER: '1' },
    permissions: { allow: ['Bash(git status *)'] },
    effortLevel: 'xhigh',
    modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } },
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "F:/!AgentBrain/hooks/worker-git-guard.mjs"' }, { type: 'command', command: 'echo keep' }] }],
      InstructionsLoaded: [{ hooks: [{ type: 'command', command: 'node "F:/!AgentBrain/hooks/instruction-metrics.mjs"' }] }],
    },
  }));
  const install = (...a) => spawnSync(process.execPath, [join(REPO, 'install.mjs'), '--home', home, ...a], { encoding: 'utf8' });
  const dry = install();
  assert.match(dry.stdout, /Dry run/);
  assert.match(JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8')).env.CLAUDE_CODE_SUBAGENT_MODEL, /opus/, 'dry run writes nothing');

  assert.equal(install('--apply').status, 0);
  const s = JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8'));
  assert.equal(s.env.CLAUDE_CODE_SUBAGENT_MODEL, 'sonnet');
  assert.equal(s.env.OTHER, '1');
  assert.equal(s.effortLevel, 'xhigh');
  assert.deepEqual(s.permissions.allow, ['Bash(git status *)']);
  assert.equal(s.modelSettings['claude-opus-5-5'].effortLevel, 'high');
  assert.equal(s.modelSettings['claude-sonnet-5'].effortLevel, 'medium');
  assert.doesNotMatch(JSON.stringify(s.hooks.InstructionsLoaded ?? []), /AgentBrain/, 'retired metrics hook removed');
  const commands = JSON.stringify(s.hooks);
  assert.doesNotMatch(commands, /AgentBrain/);
  assert.match(commands, /echo keep/);
  assert.match(commands, /git-guard\.mjs/);
  const repoPath = REPO.replace(/\\/g, '/');
  const claudeMd = readFileSync(join(home, 'CLAUDE.md'), 'utf8');
  assert.ok(claudeMd.includes(`@${repoPath}/AGENTS.md`), claudeMd);
  assert.ok(claudeMd.includes(`@${repoPath}/lessons/global/INDEX.md`));
  assert.ok(claudeMd.includes(`node ${repoPath}/tools/branch.mjs`));
  assert.match(readFileSync(join(home, 'agents', 'worker-light.md'), 'utf8'), /model: haiku/);
  for (const skill of ['handoff', 'resume', 'lesson', 'new-project']) {
    const text = readFileSync(join(home, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.doesNotMatch(text, /\{\{MERITCLAUDE\}\}|AgentBrain|F:\\/, skill);
    if (skill !== 'resume' || text.includes('branch.mjs')) assert.ok(text.includes(repoPath), skill);
  }

  const again = install('--apply');
  assert.match(again.stdout, /nothing to change/);
  assert.equal(JSON.stringify(JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8')).hooks), commands);
});
