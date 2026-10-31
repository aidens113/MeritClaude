# <Project>: Codex specifics

Read AGENTS.md for project rules and validation commands. Install global MeritPrompts rules
with `node <MeritPrompts>/install.mjs --codex --apply` before starting the session.

Use the routing table in `<MeritPrompts>/CODEX.md`: GPT-6.1 Sol Max lead/heavy review, Sol Medium
standard workers, Sol High sub-supervisors, Luna High discovery/mechanical work, and Terra
Medium visual/writing work. Honor user selections and runtime availability. Do not duplicate
the model table here; keep project-specific overrides below. GPT-6.1 Sol Max is the ceiling;
never use Astra, including for fallbacks or review.

<!-- PROJECT: Codex-specific environment or tool constraints. Remove if none apply. -->

Read relevant family lessons explicitly; Claude's @file imports do not load them in Codex.
