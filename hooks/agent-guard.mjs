// PreToolUse (Agent|Task). Enforces AGENTS.md model routing and the supervisor hierarchy:
// - Built-in agents with no model of their own must be called with an explicit `model`.
// - Fable (by parameter or by agent definition) asks the user first.
// - A `supervisor` may not spawn another `supervisor`; workers may not spawn anything.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { decidePreToolUse, isMain, runHook, SUPERVISOR_TYPE, WORKER_TYPES } from './lib.mjs';

// Built-in agents that run on the session model unless the call names one.
const INHERITS_MODEL = new Set(['general-purpose', 'Explore', 'Plan', 'claude']);

function definedModel(type, cwd) {
  for (const dir of [join(cwd ?? '.', '.claude', 'agents'), join(homedir(), '.claude', 'agents')]) {
    const file = join(dir, `${type}.md`);
    if (!existsSync(file)) continue;
    const frontmatter = readFileSync(file, 'utf8').split(/^---\s*$/m)[1] ?? '';
    return frontmatter.match(/^model:\s*['"]?([\w.-]+)/m)?.[1] ?? null;
  }
  return null;
}

export function evaluate(input) {
  const ti = input.tool_input ?? {};
  const type = ti.subagent_type || 'general-purpose';
  const model = String(ti.model ?? '').toLowerCase();
  const caller = input.agent_type;

  if (WORKER_TYPES.has(caller)) {
    return ['deny', 'Workers execute one brief and never spawn agents. Report what you need to your supervisor.'];
  }
  if (caller === SUPERVISOR_TYPE && type === SUPERVISOR_TYPE) {
    return ['deny', 'A sub-supervisor never spawns another supervisor. Dispatch worker-light, worker, or worker-heavy agents, or ask the lead to split the workstream.'];
  }
  if (model.includes('fable') || (!model && /fable/i.test(definedModel(type, input.cwd) ?? ''))) {
    return ['ask', 'Fable is used only when the user asks for it (AGENTS.md). Approve only if the user requested Fable for this task.'];
  }
  if (!model && INHERITS_MODEL.has(type)) {
    const hint = type === 'Explore' ? 'model: "haiku"' : 'model: "haiku" | "sonnet" | "opus"';
    return ['deny', `${type} has no model of its own and would run on the session model. Call it with ${hint}, or use a tiered agent: worker-light (Haiku), worker (Sonnet), worker-heavy (Opus), supervisor (Opus).`];
  }
  return null;
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const result = evaluate(input);
    if (result) decidePreToolUse(...result);
  });
}
