// SubagentStop. A worker or sub-supervisor is sent back once when its final message lacks the
// AGENTS.md return contract, or its `Report:` line is missing or names a file that does not exist
// (ported from the retired AgentBrain worker-report-guard). `Report: inline` is accepted, as the
// agent definitions allow it. A relative report path resolves against the hook input's cwd.
// The second stop is always allowed (stop_hook_active, plus a per-agent marker in case that flag
// is absent), so this can never loop.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { blockStop, isMain, runHook, SUPERVISOR_TYPE, WORKER_TYPES } from './lib.mjs';

const CONTRACT = /^\s*`*\s*Outcome:\s*(Done|Partial|Blocked)\b/m;
// "Report: <path>" as its own line, tolerating list markers, quotes and bold.
const REPORT_LINE = /^[ \t>*-]*(?:\*\*)?Report(?:\*\*)?[ \t]*:[ \t]*(\S.*?)[ \t]*$/gim;
const WRAPPERS = /^[`'"<([*]+|[`'">)\]*.]+$/g;
const INLINE = /^(inline|none|n\/a)$/i;

function lastAssistantText(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  const lines = readFileSync(transcriptPath, 'utf8').trim().split('\n').reverse();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const text = (entry.message?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (text) return text;
    } catch { /* partial line while the transcript is being written */ }
  }
  return null;
}

export function findReportPath(message) {
  let claimed = null;
  for (const match of message.matchAll(REPORT_LINE)) claimed = match[1];
  return claimed ? claimed.replace(WRAPPERS, '').trim() || null : null;
}

// What is wrong with the final message, or [] when it complies.
export function problems(message, cwd) {
  const found = [];
  if (!CONTRACT.test(message)) found.push('no return contract');
  const claimed = findReportPath(message);
  if (!claimed) {
    found.push('no Report: line');
  } else if (!INLINE.test(claimed)) {
    const path = isAbsolute(claimed) ? claimed : resolve(cwd, claimed);
    let isFile = false;
    try { isFile = statSync(path).isFile(); } catch { /* missing */ }
    if (!isFile) found.push(`no report file at ${path}`);
  }
  return found;
}

function markerPath(agentId) {
  const dir = join(tmpdir(), 'meritprompts-report-guard');
  mkdirSync(dir, { recursive: true });
  return join(dir, `${String(agentId).replace(/[^\w-]/g, '_')}.blocked`);
}

export function evaluate(input) {
  if (!WORKER_TYPES.has(input.agent_type) && input.agent_type !== SUPERVISOR_TYPE) return null;
  if (input.stop_hook_active) return null;
  const message = input.last_assistant_message ?? lastAssistantText(input.agent_transcript_path);
  if (message == null) return null;
  const found = problems(message, input.cwd || process.cwd());
  if (!found.length) return null;
  if (input.agent_id) {
    const marker = markerPath(input.agent_id);
    if (existsSync(marker)) return null;
    writeFileSync(marker, new Date().toISOString());
  }
  return `Your stop is missing what the lead needs (${found.join('; ')}). Write the report file the brief names, then end your final message with the return contract from your agent definition, and nothing after it: Outcome (Done | Partial | Blocked), Changed, Validation (exact command -> observed result), Not verified, Report (that file's path, or "inline" if the brief gave none), Notes. If you were blocked, say what you need.`;
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const reason = evaluate(input);
    if (reason) blockStop(reason);
  });
}
