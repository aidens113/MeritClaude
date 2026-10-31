# Changelog

## Unreleased

- Added concrete Codex model IDs, reasoning efforts, role assignments, selection commands,
  and escalation/availability rules, verified against official documentation on 2026-10-30.
  Validation: `npm test` passed all 52 tests after the routing update; no model calls were run.

- Separated runtime-neutral AGENTS.md policy from Claude routing, hooks, commands, and local
  memory in CLAUDE.md, and Codex tools and instruction loading in CODEX.md.
- Claude installation now imports its runtime guide explicitly; Codex snapshots exclude
  Claude model routing. Installer tests enforce that separation.

Validation: `npm test` passed 51 tests before the final policy regression check was added;
the focused installer suite then passed all 10 tests. Its first regression-check run matched
the shared lessons directory by mistake; the command-name matcher was corrected and rerun.

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

Release status: merged and pushed to dev and main. Automatic npm publication failed with
EOTP because the registry requires interactive authentication. Version 0.2.0 is not published;
until authenticated publication succeeds, use this checkout's `node install.mjs --codex --apply`.
