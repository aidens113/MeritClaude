# Changelog

## 0.2.0 — 2026-10-30

- Renamed the GitHub repository, npm package, CLI, and internal branding to MeritPrompts.
  The local checkout directory may retain its previous name. The old npm package is unchanged.
- Added CODEX.md and a project template, with explicit pointers from shared AGENTS.md rules.
- Added `install --codex` for global Codex instruction snapshots, honoring CODEX_HOME and
  --home, with dry runs, backups, repeatable installation, and --check drift detection.
- Preserved Codex settings and overrides; documented Claude-only models, hooks, and telemetry.
- Updated project scaffolding and documentation for both runtimes.

Validation: all 51 tests passed with `npm test`; the focused installer suite passed all nine
tests after final link-resolution changes. `npm pack --dry-run` confirmed the new CLI,
CODEX.md, and Codex template are packaged. No live Codex model invocation was run.
