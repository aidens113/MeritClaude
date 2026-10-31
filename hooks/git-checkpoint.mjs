// SessionStart and Stop (lead only). Backs the automatic git management in AGENTS.md.
// - SessionStart: snapshots the repository state and adds a one-line git summary to context.
// - Stop: if the tree or unpushed commits changed since the snapshot, sends the lead back once
//   to commit and push (or say why the work waits). The same state never blocks twice, and
//   changes that predate the session (the user's own work) never trigger it. When working
//   documents are among the changes, the same send-back asks for /handoff (handoff-reminder).
// - Stop, not sending back: a note instead, never a second send-back: uncommitted working
//   documents when automatic management is off, and the /clear offer after a /handoff footer.
// Opt out per repository with `git config merit.auto false`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearPrompt } from './clear-prompt.mjs';
import { handoffReminder, listPaths, uncommittedWorkingDocs } from './handoff-reminder.mjs';
import { blockStop, isMain, runHook, systemMessage } from './lib.mjs';

const MAX_FILES = 12;

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function repoState(cwd) {
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return null;
  if (git(cwd, ['config', '--get', 'merit.auto']) === 'false') return null;
  const status = git(cwd, ['status', '--porcelain', '--branch']) ?? '';
  const [header = '', ...files] = status.split(/\r?\n/);
  const branch = header.replace(/^## /, '').split('...')[0].replace(/^No commits yet on /, '');
  const upstream = git(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}']);
  const unpushed = upstream ? Number(git(cwd, ['rev-list', '--count', '@{upstream}..HEAD']) ?? 0) : null;
  const hasOrigin = (git(cwd, ['remote']) ?? '').split(/\r?\n/).includes('origin');
  const hasCommits = git(cwd, ['rev-parse', '--verify', 'HEAD']) !== null;
  const notPushed = hasOrigin && hasCommits && !upstream;
  const parent = git(cwd, ['config', '--get', `branch.${branch}.meritParent`]);
  const fingerprint = createHash('sha1').update(`${git(cwd, ['rev-parse', 'HEAD'])}\n${status}`).digest('hex');
  const top = git(cwd, ['rev-parse', '--show-toplevel']) ?? cwd;
  return { branch, parent, top, files: files.filter(Boolean), unpushed, notPushed, fingerprint };
}

// Path of a porcelain status line (renames report the new path; quoted names are unquoted).
const linePath = (line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '');

// Content hash of every dirty path, or a marker when it is gone or not a file. Fail-open: a path
// that cannot be hashed gets no entry and so is never treated as unchanged.
export function dirtyHashes(state) {
  const out = {};
  for (const line of state.files) {
    const path = linePath(line);
    const full = join(state.top, path);
    if (!existsSync(full)) { out[path] = '<deleted>'; continue; }
    const h = git(state.top, ['hash-object', '--', path]);
    if (h) out[path] = h;
  }
  return out;
}

// Dirty lines the session itself touched: those whose content differs from the session start.
export function sessionFiles(state, startHashes) {
  if (!startHashes) return state.files;
  const now = dirtyHashes(state);
  return state.files.filter((line) => {
    const path = linePath(line);
    return !(path in startHashes) || now[path] === undefined || now[path] !== startHashes[path];
  });
}

function statePath(sessionId) {
  const dir = join(tmpdir(), 'meritprompts-git-checkpoint');
  mkdirSync(dir, { recursive: true });
  return join(dir, `${String(sessionId ?? 'unknown').replace(/[^\w-]/g, '_')}.json`);
}
const load = (id) => { try { return JSON.parse(readFileSync(statePath(id), 'utf8')); } catch { return {}; } };
const save = (id, data) => writeFileSync(statePath(id), JSON.stringify(data));

export function onSessionStart(input) {
  const state = repoState(input.cwd || process.cwd());
  if (!state) return '';
  save(input.session_id, { start: state.fingerprint, hashes: dirtyHashes(state) });
  const push = state.notPushed ? 'not on origin' : state.unpushed ? `${state.unpushed} unpushed` : 'pushed';
  const tree = state.files.length ? `${state.files.length} uncommitted (pre-existing: commit only what you change)` : 'clean';
  return `Git (automatic management on): ${state.branch}${state.parent ? ` (parent ${state.parent})` : ''}, ${push}, tree ${tree}.`;
}

export function onStop(input) {
  if (input.stop_hook_active || input.agent_type) return null;
  const state = repoState(input.cwd || process.cwd());
  if (!state) return null;
  const saved = load(input.session_id);
  state.files = sessionFiles(state, saved.hashes);
  if (!state.files.length && !state.unpushed && !state.notPushed) return null;
  if (state.fingerprint === saved.start || state.fingerprint === saved.nagged) return null;
  save(input.session_id, { ...saved, nagged: state.fingerprint });
  const lines = [`Git management is automatic (AGENTS.md). On ${state.branch}:`];
  if (state.files.length) {
    lines.push(`- uncommitted: ${state.files.slice(0, MAX_FILES).map((f) => f.slice(3)).join(', ')}${state.files.length > MAX_FILES ? ', …' : ''}`);
  }
  if (state.files.some((f) => /^docs\/(working\/|$)/.test(f.slice(3).replace(/^"/, '')))) {
    const docs = uncommittedWorkingDocs(input.cwd || process.cwd());
    if (docs.length) lines.push(`- working documents: ${listPaths(docs)}. Run /handoff first so they record the state the commit describes.`);
  }
  if (state.unpushed) lines.push(`- ${state.unpushed} commit(s) not pushed`);
  if (state.notPushed) lines.push('- branch not on origin');
  lines.push('Commit validated work (stage only files this session changed) and push; merge a finished branch with `branch.mjs finish`. If it must wait (checks failing, mid-change, waiting on the user), say why in one line and stop.');
  return lines.join('\n');
}

// The single Stop output: one send-back, or one note, or nothing.
export function stopOutput(input) {
  if (input.stop_hook_active || input.agent_type) return null;
  const cwd = input.cwd || process.cwd();
  const reason = onStop(input);
  if (reason) return { block: reason };
  const notes = [];
  if (git(cwd, ['config', '--get', 'merit.auto']) === 'false') {
    const reminder = handoffReminder(uncommittedWorkingDocs(cwd));
    if (reminder) notes.push(reminder);
  }
  const clear = clearPrompt(input.last_assistant_message);
  if (clear) notes.push(clear);
  return notes.length ? { note: notes.join(' ') } : null;
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    if (input.hook_event_name === 'SessionStart') {
      const text = onSessionStart(input);
      if (text) process.stdout.write(`${text}\n`);
      return;
    }
    const out = stopOutput(input);
    if (out?.block) blockStop(out.block);
    else if (out?.note) systemMessage(out.note);
  });
}
