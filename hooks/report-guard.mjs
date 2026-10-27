// SubagentStop. A worker or sub-supervisor that stops without the AGENTS.md return contract
// is sent back once to add it. The second stop is always allowed (stop_hook_active, plus a
// per-agent marker in case that flag is absent), so this can never loop.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blockStop, isMain, runHook, SUPERVISOR_TYPE, WORKER_TYPES } from './lib.mjs';

const CONTRACT = /^\s*`*\s*Outcome:\s*(Done|Partial|Blocked)\b/m;

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

function markerPath(agentId) {
  const dir = join(tmpdir(), 'meritclaude-report-guard');
  mkdirSync(dir, { recursive: true });
  return join(dir, `${String(agentId).replace(/[^\w-]/g, '_')}.blocked`);
}

export function evaluate(input) {
  if (!WORKER_TYPES.has(input.agent_type) && input.agent_type !== SUPERVISOR_TYPE) return null;
  if (input.stop_hook_active) return null;
  const message = input.last_assistant_message ?? lastAssistantText(input.agent_transcript_path);
  if (message == null || CONTRACT.test(message)) return null;
  if (input.agent_id) {
    const marker = markerPath(input.agent_id);
    if (existsSync(marker)) return null;
    writeFileSync(marker, new Date().toISOString());
  }
  return 'End your final message with the return contract from your agent definition, and nothing after it: Outcome (Done | Partial | Blocked), Changed, Validation (exact command -> observed result), Not verified, Report, Notes. If you were blocked, say what you need.';
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const reason = evaluate(input);
    if (reason) blockStop(reason);
  });
}
