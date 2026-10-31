#!/usr/bin/env node
// Wires this repository into Claude Code's user configuration. Dry run by default.
//
//   node install.mjs            show what would change
//   node install.mjs --apply    back up and apply
//   node install.mjs --codex    preview Codex global guidance; add --apply to install
//   node install.mjs --check    line budgets, stale lesson indexes, and drift between this
//                               repository and ~/.claude; exit 1 on any problem, writes nothing
//   node install.mjs --index    regenerate lessons/*/INDEX.md from the lesson files, then exit
//   node install.mjs --home <dir>   target another directory instead of ~/.claude (tests)
//
// It (1) points ~/.claude/CLAUDE.md at AGENTS.md and the global lessons, (2) copies agents/*.md
// and skills/ (with the repository path filled in) into ~/.claude, removing the retired brain's
// agent files, and (3) merges settings.json: routing env vars, Sonnet effort, and the
// MeritPrompts hooks, removing hooks that point at the retired F:/!AgentBrain scripts.
// Re-running is safe: it replaces its own hooks instead of adding duplicates.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const APPLY = args.includes('--apply') && !CHECK;
const CODEX = args.includes('--codex');
if (args.includes('--home') && (!args[args.indexOf('--home') + 1] || args[args.indexOf('--home') + 1].startsWith('--'))) {
  throw new Error('--home requires a directory');
}
const HOME = args.includes('--home') ? args[args.indexOf('--home') + 1]
  : CODEX ? (process.env.CODEX_HOME || join(homedir(), '.codex')) : join(homedir(), '.claude');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RETIRED = /!AgentBrain/i;
// Agent files the retired brain installed that have no MeritPrompts counterpart. Its worker.md is
// simply replaced by MeritPrompts's own.
const RETIRED_AGENTS = ['lead.md', 'lead-xhigh.md', 'worker-low.md', 'worker-high.md'];

// Line budgets for the files every session or every dispatch pays for. Growth past one is a
// cost to justify, not drift; --check reports it.
const BUDGETS = { agentsMd: 240, agentBody: 60, skill: 80, lesson: 40, lessonIndex: 40 };
const GLOBAL_INTRO = [
  'Standing preferences and corrections that apply to every repository. One line per lesson; read',
  'the lesson file only when its line is relevant. Maintained by `/lesson`.',
];

const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const lineCount = (text) => text.split('\n').filter((line, i, all) => !(i === all.length - 1 && line === '')).length;
const subdirs = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []);
const mdFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []);

// --- lesson indexes ----------------------------------------------------------------------------

function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  const out = {};
  for (const line of match ? match[1].split('\n') : []) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  return out;
}

const lessonScopes = () => subdirs(join(REPO, 'lessons'));

// The lines above the first entry: an existing index's own `# ` heading and intro are kept, so a
// family can describe itself; otherwise a default heading (plus the intro, for global).
function indexHead(scope) {
  const file = join(REPO, 'lessons', scope, 'INDEX.md');
  const lines = existsSync(file) ? read(file).split('\n') : [];
  if (lines[0]?.startsWith('# ')) {
    const end = lines.findIndex((l) => l.startsWith('- '));
    const head = lines.slice(0, end === -1 ? lines.length : end);
    while (head.at(-1) === '') head.pop();
    return [...head, ''];
  }
  return scope === 'global' ? ['# Global lessons', '', ...GLOBAL_INTRO, ''] : [`# Lessons for the ${scope} family`, ''];
}

// One line per lesson: `- [<first # heading>](<slug>.md): <frontmatter description>`.
function buildIndex(scope) {
  const dir = join(REPO, 'lessons', scope);
  const out = indexHead(scope);
  for (const file of mdFiles(dir).filter((f) => f !== 'INDEX.md')) {
    const text = read(join(dir, file));
    const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const title = /^# (.+)$/m.exec(body)?.[1].trim() ?? file.replace(/\.md$/, '');
    out.push(`- [${title}](${file}): ${frontmatter(text).description ?? ''}`);
  }
  out.push('');
  return out.join('\n');
}

if (args.includes('--index')) {
  for (const scope of lessonScopes()) writeFileSync(join(REPO, 'lessons', scope, 'INDEX.md'), buildIndex(scope));
  console.log(`Lesson indexes written for: ${lessonScopes().join(', ') || 'none'}`);
  process.exit(0);
}

const ENV = {
  CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet',      // agents with no model run on Sonnet, not Opus
  CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '2', // lead -> supervisor -> worker, no deeper
};
const MODEL_SETTINGS = { 'claude-sonnet-5-5': { effortLevel: 'medium' } };

const hook = (script, timeout = 10) => ({ type: 'command', command: `node "${REPO}/hooks/${script}"`, timeout });
const HOOKS = {
  PreToolUse: [
    { matcher: 'Bash|PowerShell', hooks: [hook('git-guard.mjs')] },
    { matcher: 'Agent|Task', hooks: [hook('agent-guard.mjs')] },
  ],
  SubagentStop: [{ hooks: [hook('report-guard.mjs'), hook('usage-ledger.mjs', 15)] }],
  SessionStart: [{ matcher: 'startup|clear|compact|resume', hooks: [hook('session-context.mjs'), hook('git-checkpoint.mjs')] }],
  Stop: [{ hooks: [hook('git-checkpoint.mjs')] }],
  InstructionsLoaded: [{ hooks: [hook('instruction-metrics.mjs', 5)] }],
};

const actions = [];
const backup = (file) => {
  if (!existsSync(file)) return;
  const dir = join(HOME, 'backups');
  const target = join(dir, `${relative(HOME, file).replace(/[\\/]/g, '_')}.${STAMP}`);
  if (APPLY) { mkdirSync(dir, { recursive: true }); copyFileSync(file, target); }
  actions.push(`back up ${file} -> ${target}`);
};
const write = (file, content) => {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return;
  backup(file);
  if (APPLY) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); }
  actions.push(`write ${file}`);
};

if (CODEX) {
  const sources = ['AGENTS.md', 'CODEX.md', 'lessons/global/INDEX.md'];
  const content = [
    `<!-- Generated by ${REPO}/install.mjs --codex. Re-run after source changes. -->`,
    `<MeritPrompts> is \`${REPO}\`. Run tools as \`node ${REPO}/tools/branch.mjs\`.`,
    ...sources.map((name) => {
      let text = read(join(REPO, name));
      // Links in the copied index and policy must still resolve to repository sources.
      if (name === 'AGENTS.md') text = text.replace(/\]\((CODEX|CLAUDE)\.md\)/g, `](${REPO}/$1.md)`);
      if (name.endsWith('INDEX.md')) text = text.replace(/\]\(([^:)]+\.md)\)/g, `](${REPO}/lessons/global/$1)`);
      return text;
    }), '',
  ].join('\n\n');
  write(join(HOME, 'AGENTS.md'), content);
  if (CHECK) {
    if (actions.length) { console.error('Codex instruction drift; run install.mjs --codex --apply'); process.exit(1); }
    console.log(`MeritPrompts Codex check passed: ${HOME}`);
  } else {
    console.log(`${APPLY ? 'Applied' : 'Dry run (pass --apply to make these changes)'}: ${HOME}`);
    console.log(actions.length ? actions.map((a) => `- ${a}`).join('\n') : '- nothing to change');
  }
  if (existsSync(join(HOME, 'AGENTS.override.md'))) console.warn('AGENTS.override.md may override installed guidance');
  process.exit(0);
}

// 1. Global instructions, global lessons, and where MeritPrompts lives (AGENTS.md cannot know).
write(join(HOME, 'CLAUDE.md'), [
  `@${REPO}/AGENTS.md`,
  `@${REPO}/CLAUDE.md`,
  `@${REPO}/lessons/global/INDEX.md`,
  '',
  `<MeritPrompts> is \`${REPO}\`. Run its tools as \`node ${REPO}/tools/branch.mjs\`.`,
  '',
  `<!-- Written by ${REPO}/install.mjs. Edit the MeritPrompts repository, not this file. -->`,
  '',
].join('\n'));

// 2. Agent definitions.
for (const name of readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md'))) {
  write(join(HOME, 'agents', name), readFileSync(join(REPO, 'agents', name), 'utf8'));
}
for (const name of RETIRED_AGENTS) {
  const file = join(HOME, 'agents', name);
  if (!existsSync(file)) continue;
  backup(file);
  if (APPLY) unlinkSync(file);
  actions.push(`remove retired agent ${file}`);
}

// 3. Skills, with {{MERITPROMPTS}} replaced by this repository's path.
for (const name of readdirSync(join(REPO, 'skills'))) {
  const source = join(REPO, 'skills', name, 'SKILL.md');
  if (!existsSync(source)) continue;
  write(join(HOME, 'skills', name, 'SKILL.md'), readFileSync(source, 'utf8').replaceAll('{{MERITPROMPTS}}', REPO));
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

if (CHECK) {
  const problems = [];
  const over = (label, text, limit) => {
    const n = lineCount(text);
    if (n > limit) problems.push(`${label}: ${n} lines exceeds the ${limit}-line budget`);
  };
  over('AGENTS.md', read(join(REPO, 'AGENTS.md')), BUDGETS.agentsMd);
  for (const file of mdFiles(join(REPO, 'agents'))) {
    over(`agents/${file} (body)`, read(join(REPO, 'agents', file)).replace(/^---\n[\s\S]*?\n---\n?/, ''), BUDGETS.agentBody);
  }
  for (const skill of subdirs(join(REPO, 'skills'))) {
    const file = join(REPO, 'skills', skill, 'SKILL.md');
    if (existsSync(file)) over(`skills/${skill}/SKILL.md`, read(file), BUDGETS.skill);
    else problems.push(`skills/${skill}/SKILL.md is missing`);
  }
  for (const scope of lessonScopes()) {
    const dir = join(REPO, 'lessons', scope);
    for (const file of mdFiles(dir).filter((f) => f !== 'INDEX.md')) over(`lessons/${scope}/${file}`, read(join(dir, file)), BUDGETS.lesson);
    const index = join(dir, 'INDEX.md');
    if (!existsSync(index) || read(index) !== buildIndex(scope)) {
      problems.push(`lessons/${scope}/INDEX.md is stale; run: node install.mjs --index`);
    } else {
      over(`lessons/${scope}/INDEX.md`, read(index), BUDGETS.lessonIndex);
    }
  }
  for (const action of actions.filter((a) => !a.startsWith('back up '))) {
    problems.push(`drift: would ${action}; run: node install.mjs --apply`);
  }
  if (problems.length) {
    console.error(`MeritPrompts check failed (${HOME}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`MeritPrompts check passed: ${HOME}`);
  process.exit(0);
}

console.log(`${APPLY ? 'Applied' : 'Dry run (pass --apply to make these changes)'}: ${HOME}`);
console.log(actions.length ? actions.map((a) => `- ${a}`).join('\n') : '- nothing to change');
