# Agent Instructions: <Project>

The global rules (roles, model routing, workflow modes, delegation, automatic git management)
load from MeritClaude for every session. This file adds what is specific to this repository and
wins where the two conflict.

## Purpose

<!-- PROJECT: what this repository is, in two or three sentences, and who uses it. -->

## Start Here

Read the [handoff](docs/working/handoff.md) if it exists, then the
[working document index](docs/working/README.md) and the `Current State` of the relevant
document.

## Repository Boundary

<!-- PROJECT: what must never be committed (secrets, runtime state, user data), and any boundary
with a sibling repository. -->

## Code Structure

<!-- PROJECT: where code lives by area, test layout, generated files and how they are rebuilt,
and rules such as "no catch-all files". -->

## Validation

Run these before the final response for a code change, and pass them as `--check` to
`branch.mjs finish` and `promote`:

```bash
<!-- PROJECT: the check, test, and build commands. -->
```

## Git

<!-- PROJECT: overrides to automatic git management, if any: for example "dev pushes only after
the full build", "no worktrees", or `git config merit.auto false` for manual git. Delete this
section if the global rules apply as they are. -->

## Documentation Maintenance

After a substantial change, update the authored documentation in the same unit of work.
<!-- PROJECT: which documents and which changes count as substantial. -->
