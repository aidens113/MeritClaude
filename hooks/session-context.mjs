// SessionStart. In a repository with docs/working, prints the handoff pointer and the
// Active/Blocked rows of the working-document index; Claude Code adds this stdout to the
// lead's context. Prints nothing elsewhere, so ordinary sessions pay no context.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, runHook } from './lib.mjs';

const MAX_ROWS = 12;
const MAX_SCOPE = 110;

export function buildContext(cwd) {
  const working = join(cwd, 'docs', 'working');
  if (!existsSync(working)) return '';
  const lines = ['MeritClaude session context (docs/working):'];
  if (existsSync(join(working, 'handoff.md'))) {
    lines.push('- Handoff: docs/working/handoff.md. Read it before touching work in progress.');
  }
  const index = join(working, 'README.md');
  if (existsSync(index)) {
    const rows = [];
    for (const line of readFileSync(index, 'utf8').split(/\r?\n/)) {
      const cells = line.split('|').map((c) => c.trim());
      if (cells.length < 4 || !/^(Active|Blocked)$/.test(cells[2])) continue;
      const name = cells[1].replace(/^\[([^\]]+)\].*$/, '$1');
      const scope = cells[3].length > MAX_SCOPE ? `${cells[3].slice(0, MAX_SCOPE)}…` : cells[3];
      rows.push(`- ${cells[2]}: ${name}: ${scope}`);
    }
    if (rows.length) {
      lines.push(...rows.slice(0, MAX_ROWS));
      if (rows.length > MAX_ROWS) lines.push(`- …and ${rows.length - MAX_ROWS} more in docs/working/README.md`);
    }
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const text = buildContext(input.cwd || process.cwd());
    if (text) process.stdout.write(`${text}\n`);
  });
}
