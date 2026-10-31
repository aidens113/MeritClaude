// Shared plumbing for MeritPrompts hooks: read the hook's JSON input from stdin and emit
// Claude Code's documented hook outputs. Every hook fails open: an internal error is
// written to stderr (a non-blocking hook error) and never blocks the session.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const WORKER_TYPES = new Set(['worker-light', 'worker', 'worker-heavy']);
export const SUPERVISOR_TYPE = 'supervisor';

export function readInput() {
  const raw = readFileSync(0, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function decidePreToolUse(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
}

export function blockStop(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

// A non-blocking note shown to the user; never a send-back.
export function systemMessage(text) {
  process.stdout.write(JSON.stringify({ systemMessage: text }));
}

export function runHook(handler) {
  try {
    handler(readInput());
  } catch (error) {
    process.stderr.write(`MeritPrompts hook error: ${error?.stack ?? error}\n`);
  }
  process.exit(0);
}

// True when the module is the script node was started with (not imported by a test).
export function isMain(moduleUrl) {
  const entry = process.argv[1];
  return Boolean(entry) && pathToFileURL(entry).href.toLowerCase() === moduleUrl.toLowerCase();
}
