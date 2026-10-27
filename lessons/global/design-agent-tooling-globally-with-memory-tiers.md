---
name: design-agent-tooling-globally-with-memory-tiers
scope: global
description: Aiden wants agent instructions, delegation rules, and memory designed to work globally across all his projects, with explicit global shared memory and project-specific memory, and with token cost as a first-class design constraint.
origin: FluxIQWebExtension auto-memory, promoted 2026-09-10
---

# Design agent tooling globally, with global and project memory tiers

Aiden brought a plan, drafted with an advisor, for cutting token cost by
keeping the directly prompted agent light and pushing heavy work into
workers. He asked for it to be refined to fit the FluxIQ systems already in
place, and he set two standing requirements: the system must work globally
for every project he starts in the future, and it must distinguish global
shared memory from project-specific memory rather than mixing the two.

Apply this whenever authoring or revising agent instructions, memory
placement, hooks, skills, or subagent definitions. Anything that applies to
all projects (role vocabulary, delegation rules, worker model, report
contracts, handoff discipline, lessons that generalize) belongs in a global
layer under `~/.claude/` or a shared brain repository imported from there,
not only in one repository's `AGENTS.md` or one project's auto-memory.
Anything that is true of a single repository (architecture, commands,
boundaries, task state) stays in that repository, tracked in git. When a
lesson could apply beyond the current project, record it in the global tier
as well as the project tier.

Treat per-task token cost as a design constraint, not an afterthought:
prefer instruction that loads only when relevant, workers that return short
structured summaries with detail in report files, and mechanical checks over
prose. He explicitly invited full rewriting of his draft, so refine the
substance rather than lightly editing the wording.
