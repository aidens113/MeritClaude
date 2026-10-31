# MeritPrompts: Codex specifics

Read AGENTS.md for shared policy. This guide applies only to Codex sessions.

## Model routing

These are MeritPrompts defaults, chosen for this repository's supervisor/worker workflow.
Model IDs and supported selection controls were checked against official OpenAI documentation
on 2026-10-30. Respect an explicit user model choice over these defaults.

**Hard ceiling: GPT-6.1 Sol at Max effort. Never use Astra for any role, fallback, or review.**

| Role | Model ID | Reasoning effort | Assignments |
| --- | --- | --- | --- |
| Lead supervisor | `gpt-6.1-sol` | `max` | Planning, delegation, integration, final verification, and git management. |
| Sub-supervisor | `gpt-6.1-sol` | `high` | Own a bounded workstream; use Max effort for architecture, security, or data integrity. |
| Discovery / light worker | `gpt-6-luna` | `high` | Read-only searches, named commands, log summaries, and fully specified mechanical edits. |
| Standard worker | `gpt-6.1-sol` | `medium` | Features, tests, known-cause fixes, refactors, and first-pass review. |
| Heavy worker | `gpt-6.1-sol` | `max` | Unknown-cause debugging, concurrency, migrations, security, and critical review. |
| Visual / writing worker | `gpt-6.1-terra` | `medium` | Screenshot interpretation, UI inspection, supplied-material writing, and scoped UI fixes. |

**Dispatch.** State the role, exact model ID, and effort in each brief. Set model and effort
explicitly through the runtime's agent controls when those controls are exposed. Role names
above are responsibilities, not registered Codex agent types. Do not use Claude agent files.

**Escalation.** For coding failures, move Luna or Terra -> Sol Medium -> Sol High -> Sol Max,
once per tier, carrying the failed report and observed checks. Max is the ceiling; never
escalate to another model or Ultra. Fix an inadequate brief before retrying. If Sol Max cannot
resolve the task, report the remaining blocker. The lead verifies returned claims itself.

**Availability.** Check the models and efforts exposed by the current runtime before dispatch.
If Luna or Terra is unavailable, use Sol. If Max effort is unavailable, use the highest exposed
Sol effort up to Max and report the limitation. If Sol is unavailable, report the blocker for
lead/heavy work; do not substitute Astra or silently route critical work to a lighter model.
Runtime restrictions on delegation or model overrides take precedence. Do not claim that this
file changes the running lead's model.

**Select the lead.** Launch `codex -m gpt-6.1-sol`, then use `/model` to select Max effort.
For routine work, launch `codex -m gpt-6.1-sol` and select Medium. In the app or IDE, use its
model and reasoning picker. Terra requires Codex CLI 0.159.0 or later. The installer writes
instructions only; it preserves config.toml and does not register or configure worker agents.

Sources: [OpenAI models](https://learn.chatgpt.com/docs/models) and
[model selection](https://learn.chatgpt.com/docs/model-selection). The role assignments and
escalation sequence above are repository policy, not OpenAI-mandated mappings.

## Runtime behavior

- The lead is the current Codex session and configured model. Use only models and agent tools
  exposed by the current runtime; do not invent model mappings or load another runtime's agent
  definitions. Keep the configured model when a suitable cheaper model is unavailable.
- Preserve shared ownership, briefs, reporting, verification, and lead-only git rules.
  Delegate only when the runtime permits it. Otherwise work serially and state the limitation.
  Workers never spawn agents. Choose cheaper available models only when reliable.
- Shared policy is followed through the available Codex tools; this repository installs
  no enforcement hooks or usage telemetry into Codex.
- Codex discovers AGENTS.md automatically. Read CODEX.md through its explicit pointer and
  read relevant lesson files explicitly; Claude's @file imports do not load them in Codex.
- The installer writes a snapshot of shared rules, this adapter, and the global lesson index
  into `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`). Re-run after source changes
  and start a new session. Existing AGENTS.override.md takes precedence and is preserved.
- Read the handoff and update working documents directly. Record reusable lessons under
  <MeritPrompts>/lessons/ and regenerate indexes with node <MeritPrompts>/install.mjs --index.
  Keep local-only memory in the runtime-provided location; never commit it.

## Maintaining MeritPrompts

- Hooks are dependency-free Node ESM, export decision functions for tests, and fail open.
- Validate with `npm test`; tests use throwaway homes and MERIT_USAGE_LOG paths.
- After agent edits run `node install.mjs --apply` to refresh Claude's installed copies.
- Merge with `node tools/branch.mjs finish --check "npm test"`; promote with
  `node tools/branch.mjs promote --check "npm test"`.

Instruction discovery: https://learn.chatgpt.com/docs/agent-configuration/agents-md
