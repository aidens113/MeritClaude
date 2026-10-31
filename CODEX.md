# MeritPrompts: Codex specifics

Read AGENTS.md for shared policy. This guide applies only to Codex sessions.

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

When editing MeritPrompts itself:

- Hooks are dependency-free Node ESM, export decision functions for tests, and fail open.
- Validate with `npm test`; tests use throwaway homes and MERIT_USAGE_LOG paths.
- After agent edits run `node install.mjs --apply` to refresh Claude's installed copies.
- Merge with `node tools/branch.mjs finish --check "npm test"`; promote with
  `node tools/branch.mjs promote --check "npm test"`.

Instruction discovery: https://learn.chatgpt.com/docs/agent-configuration/agents-md
