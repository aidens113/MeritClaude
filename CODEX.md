# MeritPrompts: Codex specifics

AGENTS.md is the shared policy. This adapter overrides its Claude-specific runtime assumptions
for Codex sessions.

- The lead is the current Codex session and configured model. Claude model names, agent types,
  and agents/*.md frontmatter are Claude settings, not Codex model IDs. Use only models and
  agent tools exposed by the current runtime; do not invent equivalent model mappings.
- Preserve shared ownership, briefs, reporting, verification, and lead-only git rules.
  Delegate only when the runtime permits it. Otherwise work serially and state the limitation.
  Workers never spawn agents. Choose cheaper available models only when reliable.
- Claude hooks, settings.json, and usage telemetry do not run in Codex. Hook-marked rules
  remain behavioral requirements without a claim of automatic enforcement.
- Codex discovers AGENTS.md automatically. Read CODEX.md through its explicit pointer and
  read relevant lesson files explicitly; Claude's @file imports do not load them in Codex.
- The installer writes a snapshot of shared rules, this adapter, and the global lesson index
  into `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`). Re-run after source changes
  and start a new session. Existing AGENTS.override.md takes precedence and is preserved.
- Runtime approval and sandbox restrictions still apply to every command and git operation.

When editing MeritPrompts itself:

- Hooks are dependency-free Node ESM, export decision functions for tests, and fail open.
- Validate with `npm test`; tests use throwaway homes and MERIT_USAGE_LOG paths.
- After agent edits run `node install.mjs --apply` to refresh Claude's installed copies.
- Merge with `node tools/branch.mjs finish --check "npm test"`; promote with
  `node tools/branch.mjs promote --check "npm test"`.

Instruction discovery: https://learn.chatgpt.com/docs/agent-configuration/agents-md
