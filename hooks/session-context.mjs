// SessionStart. In a repository with docs/working, prints the handoff pointer, uncommitted
// working documents, and the Active/Blocked rows of the working-document index; Claude Code adds
// this stdout to the lead's context. Prints nothing elsewhere, so ordinary sessions pay no context.
// The index may mark status either way:
// - a Status column: `| Document | Status | Scope |`, or
// - section headings: `## Active` / `## Blocked`, each followed by a table such as
//   `| Document | Owner | Lines | Scope | Paired ... |`.
// Columns are found by header name; a table without a header falls back to Document | Status | Scope.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listPaths, uncommittedWorkingDocs } from './handoff-reminder.mjs';
import { isMain, runHook } from './lib.mjs';

const MAX_LINES = 15;
const MAX_SCOPE = 110;
const STATUS = /^(Active|Blocked)$/i;
const RESUME_HINT = '- Run /resume <document> to load one document\'s Current State.';

const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isDelimiter = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes('-');
const linkText = (cell) => cell.replace(/^\[([^\]]+)\]\([^)]*\).*$/, '$1').replace(/[`*]/g, '').trim();
const titleCase = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();

export function parseIndex(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let section = null;
  let columns = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const word = heading[1].match(/^(Active|Blocked)\b/i);
      section = word ? titleCase(word[1]) : null;
      columns = null;
      continue;
    }
    if (!isRow(line)) {
      if (line.trim()) columns = null;
      continue;
    }
    if (isDelimiter(line)) continue;
    const cells = cellsOf(line);
    if (isDelimiter(lines[i + 1] ?? '')) {
      const names = cells.map((c) => c.toLowerCase());
      const at = (name) => { const k = names.indexOf(name); return k === -1 ? null : k; };
      columns = { doc: at('document') ?? 0, status: at('status'), scope: at('scope') };
      continue;
    }
    const cols = columns ?? { doc: 0, status: 1, scope: 2 };
    const status = cols.status != null ? cells[cols.status] ?? '' : section ?? '';
    if (!STATUS.test(status)) continue;
    const name = linkText(cells[cols.doc] ?? '');
    if (!name) continue;
    rows.push({ status: titleCase(status), name, scope: cols.scope != null ? cells[cols.scope] ?? '' : '' });
  }
  return rows;
}

function workingDir(cwd) {
  const direct = join(cwd, 'docs', 'working');
  return existsSync(direct) ? direct : null;
}

export function buildContext(cwd) {
  const working = workingDir(cwd);
  if (!working) return '';
  const head = ['MeritPrompts session context (docs/working):'];
  if (existsSync(join(working, 'handoff.md'))) {
    head.push('- Handoff: docs/working/handoff.md. Read it before touching work in progress.');
  }
  const dirty = uncommittedWorkingDocs(cwd);
  if (dirty.length) head.push(`- Uncommitted working documents (${dirty.length}): ${listPaths(dirty, 4)}`);

  const index = join(working, 'README.md');
  const rows = existsSync(index) ? parseIndex(readFileSync(index, 'utf8')) : [];
  const lines = rows.map(({ status, name, scope }) => {
    const short = scope.length > MAX_SCOPE ? `${scope.slice(0, MAX_SCOPE)}…` : scope;
    return `- ${status}: ${name}${short ? `: ${short}` : ''}`;
  });
  if (head.length === 1 && !lines.length) return '';

  let room = MAX_LINES - head.length - 1; // the hint takes the last line
  if (lines.length > room) room -= 1;     // and an overflow line, when needed
  const body = lines.slice(0, Math.max(room, 0));
  if (lines.length > body.length) body.push(`- …and ${lines.length - body.length} more in docs/working/README.md`);
  return [...head, ...body, RESUME_HINT].join('\n');
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const text = buildContext(input.cwd || process.cwd());
    if (text) process.stdout.write(`${text}\n`);
  });
}
