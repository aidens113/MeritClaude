#!/usr/bin/env node
// Wires this repository into Claude Code's user configuration. Dry run by default.
//
//   node install.mjs            show what would change
//   node install.mjs --apply    back up and apply
//   node install.mjs --home <dir>   target another directory instead of ~/.claude (tests)
//
// It (1) points ~/.claude/CLAUDE.md at AGENTS.md and the global lessons, (2) copies agents/*.md
// and skills/ (with the repository path filled in) into ~/.claude,
// and (3) merges settings.json: routing env vars, Sonnet effort, and the
// MeritClaude hooks, removing hooks that point at the retired F:/!AgentBrain scripts.
// Re-running is safe: it replaces its own hooks instead of adding duplicates.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const HOME = args.includes('--home') ? args[args.indexOf('--home') + 1] : join(homedir(), '.claude');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RETIRED = /!AgentBrain/i;

const ENV = {
  CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet',      // agents with no model run on Sonnet, not Opus
  CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '2', // lead -> supervisor -> worker, no deeper
};
const MODEL_SETTINGS = { 'claude-sonnet-5': { effortLevel: 'medium' } };

const hook = (script, timeout = 10) => ({ type: 'command', command: `node "${REPO}/hooks/${script}"`, timeout });
const HOOKS = {
  PreToolUse: [
    { matcher: 'Bash|PowerShell', hooks: [hook('git-guard.mjs')] },
    { matcher: 'Agent|Task', hooks: [hook('agent-guard.mjs')] },
  ],
  SubagentStop: [{ hooks: [hook('report-guard.mjs'), hook('usage-ledger.mjs', 15)] }],
  SessionStart: [{ matcher: 'startup|clear|compact|resume', hooks: [hook('session-context.mjs'), hook('git-checkpoint.mjs')] }],
  Stop: [{ hooks: [hook('git-checkpoint.mjs')] }],
};

const actions = [];
const backup = (file) => {
  if (!existsSync(file)) return;
  const dir = join(HOME, 'backups');
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `${relative(HOME, file).replace(/[\\/]/g, '_')}.${STAMP}`);
  if (APPLY) copyFileSync(file, target);
  actions.push(`back up ${file} -> ${target}`);
};
const write = (file, content) => {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return;
  backup(file);
  if (APPLY) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); }
  actions.push(`write ${file}`);
};

// 1. Global instructions, global lessons, and where MeritClaude lives (AGENTS.md cannot know).
write(join(HOME, 'CLAUDE.md'), [
  `@${REPO}/AGENTS.md`,
  `@${REPO}/lessons/global/INDEX.md`,
  '',
  `<MeritClaude> is \`${REPO}\`. Run its tools as \`node ${REPO}/tools/branch.mjs\`.`,
  '',
  `<!-- Written by ${REPO}/install.mjs. Edit the MeritClaude repository, not this file. -->`,
  '',
].join('\n'));

// 2. Agent definitions.
for (const name of readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md'))) {
  write(join(HOME, 'agents', name), readFileSync(join(REPO, 'agents', name), 'utf8'));
}

// 3. Skills, with {{MERITCLAUDE}} replaced by this repository's path.
for (const name of readdirSync(join(REPO, 'skills'))) {
  const source = join(REPO, 'skills', name, 'SKILL.md');
  if (!existsSync(source)) continue;
  write(join(HOME, 'skills', name, 'SKILL.md'), readFileSync(source, 'utf8').replaceAll('{{MERITCLAUDE}}', REPO));
}

// 4. Settings.
const settingsPath = join(HOME, 'settings.json');
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
settings.env = { ...settings.env, ...ENV };
settings.modelSettings = { ...settings.modelSettings };
for (const [model, value] of Object.entries(MODEL_SETTINGS)) {
  settings.modelSettings[model] = { ...settings.modelSettings[model], ...value };
}
const ours = (h) => RETIRED.test(h.command ?? '') || (h.command ?? '').includes(`${REPO}/hooks/`);
const hooks = {};
for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
  const kept = groups
    .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) }))
    .filter((g) => g.hooks.length > 0);
  const removed = groups.flatMap((g) => g.hooks ?? []).filter(ours).filter((h) => RETIRED.test(h.command));
  for (const h of removed) actions.push(`remove retired ${event} hook: ${h.command}`);
  if (kept.length) hooks[event] = kept;
}
for (const [event, groups] of Object.entries(HOOKS)) hooks[event] = [...(hooks[event] ?? []), ...groups];
settings.hooks = hooks;
write(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

console.log(`${APPLY ? 'Applied' : 'Dry run (pass --apply to make these changes)'}: ${HOME}`);
console.log(actions.length ? actions.map((a) => `- ${a}`).join('\n') : '- nothing to change');
