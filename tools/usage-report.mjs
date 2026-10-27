#!/usr/bin/env node
// Summarise the subagent usage ledger written by hooks/usage-ledger.mjs: token totals by the
// model each subagent actually ran on, and by agent type. Prices change, so this reports
// tokens only; multiply by current pricing yourself. Output is an estimate (see usage-ledger).
//
//   node tools/usage-report.mjs [--since YYYY-MM-DD] [--cwd <substring>] [--log <path>]
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const log = opt('log') || process.env.MERIT_USAGE_LOG || join(homedir(), '.claude', 'merit', 'usage.ndjson');
const since = opt('since');
const cwdFilter = opt('cwd')?.toLowerCase();

if (!existsSync(log)) {
  console.log(`No usage ledger at ${log} yet. It fills as subagents stop.`);
  process.exit(0);
}

// A subagent sent back by report-guard is logged at each stop; keep its last line.
const latest = new Map();
for (const line of readFileSync(log, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    const e = JSON.parse(line);
    if (since && e.time < since) continue;
    if (cwdFilter && !String(e.cwd ?? '').toLowerCase().includes(cwdFilter)) continue;
    latest.set(e.agent_id ?? `${e.time}-${latest.size}`, e);
  } catch { /* skip malformed */ }
}

const byModel = {};
const byType = {};
const mismatches = [];
for (const e of latest.values()) {
  for (const [model, u] of Object.entries(e.models ?? {})) {
    const m = (byModel[model] ??= { agents: 0, requests: 0, input: 0, cache_write: 0, cache_read: 0, output_est: 0 });
    m.agents += 1;
    for (const k of ['requests', 'input', 'cache_write', 'cache_read', 'output_est']) m[k] += u[k] ?? 0;
    const t = (byType[`${e.agent_type} → ${model}`] ??= { agents: 0, output_est: 0 });
    t.agents += 1;
    t.output_est += u.output_est ?? 0;
  }
  const expected = { 'worker-light': 'haiku', worker: 'sonnet', 'worker-heavy': 'opus' }[e.agent_type];
  const used = Object.keys(e.models ?? {});
  if (expected && used.length && !used.some((m) => m.includes(expected)) && !e.requested_model) {
    mismatches.push(`${e.agent_type} ${e.agent_id} ran on ${used.join(', ')}`);
  }
}

const fmt = (n) => n.toLocaleString('en-US');
console.log(`Subagents: ${latest.size}  (ledger: ${log}${since ? `, since ${since}` : ''})\n`);
console.log('By model');
console.table(Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, fmt(b)]))])));
console.log('By agent type → model');
console.table(Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, { agents: v.agents, output_est: fmt(v.output_est) }])));
if (mismatches.length) {
  console.log('Tier mismatches (a tiered agent ran on an unexpected model):');
  for (const m of mismatches) console.log(`- ${m}`);
}
