// SubagentStop. Appends one line per stopped subagent to the usage ledger: the models it
// actually ran on (from its transcript) and token totals per model. Hook inputs carry no
// model field, so the transcript is the only reliable source. A subagent sent back by
// report-guard stops twice; tools/usage-report.mjs keeps the last line per agent_id.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isMain, runHook } from './lib.mjs';

export const LEDGER = process.env.MERIT_USAGE_LOG || join(homedir(), '.claude', 'merit', 'usage.ndjson');

// Transcript lines record usage when a response starts streaming: input and cache counts are
// exact, but output_tokens is a placeholder. Output is therefore estimated from the content
// the agent wrote (text, thinking, tool inputs) at about four characters per token.
const CHARS_PER_TOKEN = 4;

function blockChars(block) {
  if (block.type === 'text') return block.text?.length ?? 0;
  if (block.type === 'thinking') return block.thinking?.length ?? 0;
  if (block.type === 'tool_use') return JSON.stringify(block.input ?? {}).length;
  return 0;
}

export function summarizeTranscript(text) {
  // Streaming writes one line per content block, each repeating the message id and usage.
  const byMessage = new Map();
  for (const line of text.split('\n')) {
    if (!line.includes('"assistant"')) continue;
    try {
      const entry = JSON.parse(line);
      const message = entry.message;
      if (entry.type !== 'assistant' || !message?.id || !message.usage) continue;
      const seen = byMessage.get(message.id) ?? { model: message.model, usage: message.usage, blocks: new Map() };
      (message.content ?? []).forEach((block, i) => seen.blocks.set(`${entry.apiBlockIndex ?? 0}:${i}`, blockChars(block)));
      byMessage.set(message.id, seen);
    } catch { /* partial line */ }
  }
  const models = {};
  for (const { model, usage, blocks } of byMessage.values()) {
    if (!model || model === '<synthetic>') continue;
    const m = (models[model] ??= { requests: 0, input: 0, cache_write: 0, cache_read: 0, output_est: 0 });
    m.requests += 1;
    m.input += usage.input_tokens ?? 0;
    m.cache_write += usage.cache_creation_input_tokens ?? 0;
    m.cache_read += usage.cache_read_input_tokens ?? 0;
    let chars = 0;
    for (const c of blocks.values()) chars += c;
    m.output_est += Math.max(usage.output_tokens ?? 0, Math.ceil(chars / CHARS_PER_TOKEN));
  }
  return models;
}

export function buildEntry(input) {
  const path = input.agent_transcript_path;
  if (!path || !existsSync(path)) return null;
  const metaPath = path.replace(/\.jsonl$/, '.meta.json');
  let meta = {};
  try { if (existsSync(metaPath)) meta = JSON.parse(readFileSync(metaPath, 'utf8')); } catch { /* optional */ }
  return {
    time: new Date().toISOString(),
    session_id: input.session_id,
    cwd: input.cwd,
    agent_id: input.agent_id,
    agent_type: input.agent_type ?? meta.agentType,
    requested_model: meta.model ?? null,
    spawn_depth: meta.spawnDepth ?? null,
    description: meta.description ?? null,
    models: summarizeTranscript(readFileSync(path, 'utf8')),
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
