<!-- Template: copy to the repository root as AGENTS.md and resolve every PROJECT comment. Claude
Code strips block HTML comments, so a resolved placeholder costs nothing. Keep this file short:
every agent pays for it on every task. -->

# Agent Instructions: <Project>

The global rules (roles, model routing, workflow modes, delegation, automatic git management)
load from MeritPrompts for every session. This file adds what is specific to this repository and
wins where the two conflict. Install global rules for the runtime in use first.
Codex sessions: read [CODEX.md](CODEX.md). Claude sessions: read [CLAUDE.md](CLAUDE.md).

## Purpose

<!-- PROJECT: what this repository is and what it is not, in two or three sentences, so an agent
can tell work that belongs here from work that belongs in a neighbouring repository; and who uses
it. -->

## Start Here

Read the [handoff](docs/working/handoff.md) if it exists, then the
[working document index](docs/working/README.md) and the `Current State` of the relevant
document.

<!-- PROJECT: one bullet per background document the lead should open, each naming the condition
that makes it worth opening and, where it applies, when to skip it: typically the product or
roadmap document before planning substantive feature work, and the layout-and-commands document
when the package structure or exact commands are needed. Workers read only their brief. -->

## Repository Boundary

<!-- PROJECT: which directories own which concerns and the permitted direction of dependencies
between them; if there is a paired or upstream repository, when editing it is allowed and what
the user must be told before the first such edit; what must never be committed (secrets,
generated output, runtime state, captured data, profiles); and the tokens, credentials, captured
data, and local state that must never appear in logs or responses. -->

## Code Structure

<!-- PROJECT: where code lives by area, test layout, generated files and how they are rebuilt,
and rules such as "no catch-all files". -->

## Validation

Run the narrowest relevant checks while iterating. Run these before the final response for a
code change, and pass them as `--check` to `branch.mjs finish` and `promote`:

```bash
<!-- PROJECT: the check, test, and build commands. -->
```

<!-- PROJECT: which kinds of change compilation and automated tests cannot prove here. Those need
a manual run when feasible, and the agent states what was and was not exercised. -->

## Live Validation

<!-- PROJECT: the live-validation rules specific to this system: which runtime, build target, or
device to exercise and what state to record; which long-running processes an agent may start,
stop, or restart, and under what authorization; and which profiles, data, or artifacts must be
preserved rather than reset. Delete this section if nothing here runs live. -->

## Git

<!-- PROJECT: overrides to automatic git management, if any: for example "dev pushes only after
the full build", "no worktrees", or `git config merit.auto false` for manual git. Delete this
section if the global rules apply as they are. -->

## Documentation Maintenance

After a substantial change, update the authored documentation in the same unit of work unless
the user says not to; when the user asks for documentation updates, they are required work.
Keep current-state design in `docs/architecture/` and task-specific plans in `docs/working/`.
<!-- PROJECT: which documents, and which changes count as substantial: the contracts, protocols,
permissions, layouts, and ownership boundaries whose change obliges a documentation update. -->
