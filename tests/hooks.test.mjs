// Runs each hook as Claude Code does: a node process with the hook JSON on stdin.
//   node --test tests/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'Outcome: Done\nChanged: a.ts' }), null);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: '```text\nOutcome: Partial\n```' }), null);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'All done!', stop_hook_active: true }), null);
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'All done!' }).decision, 'block');
  assert.equal(stop({ agent_type: 'worker', last_assistant_message: 'Still no contract' }), null, 'second stop is allowed');
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

test('session-context: lists Active and Blocked working documents only', () => {
  const dir = tmp();
  mkdirSync(join(dir, 'docs', 'working'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'working', 'handoff.md'), '# Handoff\n');
  writeFileSync(join(dir, 'docs', 'working', 'README.md'), [
    '| Document | Status | Scope |', '| --- | --- | --- |',
    '| [a.md](a.md) | Active | Doing A |', '| [b.md](b.md) | Complete | Done B |', '| [c.md](c.md) | Blocked | Waiting on C |',
  ].join('\r\n'));
  const r = spawnSync(process.execPath, [join(REPO, 'hooks/session-context.mjs')], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' });
  assert.match(r.stdout, /handoff\.md/);
  assert.match(r.stdout, /Active: a\.md: Doing A/);
  assert.match(r.stdout, /Blocked: c\.md: Waiting on C/);
  assert.doesNotMatch(r.stdout, /b\.md/);
  const empty = spawnSync(process.execPath, [join(REPO, 'hooks/session-context.mjs')], { input: JSON.stringify({ cwd: tmp() }), encoding: 'utf8' });
  assert.equal(empty.stdout, '');
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
  assert.equal(s.hooks.InstructionsLoaded, undefined);
  const commands = JSON.stringify(s.hooks);
  assert.doesNotMatch(commands, /AgentBrain/);
  assert.match(commands, /echo keep/);
  assert.match(commands, /git-guard\.mjs/);
  assert.match(readFileSync(join(home, 'CLAUDE.md'), 'utf8'), /AGENTS\.md/);
  assert.match(readFileSync(join(home, 'agents', 'worker-light.md'), 'utf8'), /model: haiku/);

  const again = install('--apply');
  assert.match(again.stdout, /nothing to change/);
  assert.equal(JSON.stringify(JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8')).hooks), commands);
});
