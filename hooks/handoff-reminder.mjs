// Uncommitted working documents (ported from the retired AgentBrain handoff-reminder).
// Not a hook of its own: git-checkpoint's Stop path folds the reminder into its single send-back
// (or into a note when automatic git management is off), and session-context lists the same
// paths at session start. Keeping it here gives both one definition of "uncommitted docs".
import { spawnSync } from 'node:child_process';

const MAX_PATHS = 5;

// trimEnd, not trim: porcelain puts a status character in column 1 and a space in column 2.
function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, '-c', 'core.quotepath=false', ...args], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 && typeof r.stdout === 'string' ? r.stdout.trimEnd() : null;
}

// Paths under docs/working with uncommitted changes, relative to the repository root; [] outside git.
export function uncommittedWorkingDocs(cwd) {
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!root) return [];
  const out = git(root, ['status', '--porcelain', '--untracked-files=all', '--', 'docs/working']);
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    const entry = line.slice(3).trim();
    const rename = entry.lastIndexOf(' -> ');
    return (rename === -1 ? entry : entry.slice(rename + 4)).replace(/^"|"$/g, '');
  });
}

export function listPaths(paths, max = MAX_PATHS) {
  return `${paths.slice(0, max).join(', ')}${paths.length > max ? `, and ${paths.length - max} more` : ''}`;
}

export function handoffReminder(paths) {
  if (!paths.length) return null;
  return `Uncommitted working documents: ${listPaths(paths)}. Run /handoff to record state before this session ends.`;
}
