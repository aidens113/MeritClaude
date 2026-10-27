// InstructionsLoaded. Appends one line per instruction-file load (CLAUDE.md, AGENTS.md imports,
// rules) to the instruction ledger, so the context cost of the instruction hierarchy can be
// measured. Records the file's size, never its content. Ported from the retired AgentBrain
// instruction-metrics; MERIT_INSTRUCTIONS_LOG redirects the ledger as MERIT_USAGE_LOG does.
import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isMain, runHook } from './lib.mjs';

export const LEDGER = process.env.MERIT_INSTRUCTIONS_LOG || join(homedir(), '.claude', 'merit', 'instructions.ndjson');

const str = (v) => (typeof v === 'string' && v ? v : null);

function sizeOnDisk(file) {
  try { return statSync(file).size; } catch { return null; }
}

export function buildEntry(input) {
  if (input.hook_event_name && input.hook_event_name !== 'InstructionsLoaded') return null;
  const file = str(input.file_path);
  if (!file) return null;
  return {
    time: new Date().toISOString(),
    session_id: str(input.session_id),
    cwd: str(input.cwd),
    agent_type: str(input.agent_type),
    file_path: file,
    memory_type: str(input.memory_type),
    load_reason: str(input.load_reason),
    parent_file_path: str(input.parent_file_path),
    bytes: typeof input.content === 'string' ? Buffer.byteLength(input.content, 'utf8') : sizeOnDisk(file),
  };
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const entry = buildEntry(input);
    if (!entry) return;
    mkdirSync(dirname(LEDGER), { recursive: true });
    appendFileSync(LEDGER, `${JSON.stringify(entry)}\n`);
  });
}
