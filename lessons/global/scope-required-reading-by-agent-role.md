---
name: scope-required-reading-by-agent-role
scope: global
description: Agent instruction files must scope required reading by who initiated the request, rather than mandating full-document reads for every agent and subagent.
origin: FluxIQWebExtension auto-memory, promoted 2026-09-10
---

# Scope required reading by agent role, not by blanket mandate

Aiden pointed out that an `AGENTS.md` demanding every agent and subagent read
the full instruction set at the start of every request is too expensive:
subagent context is scarce, and a large mandatory preamble consumes budget
that the actual task needs. He asked for required reading to be conditional —
"read if it makes sense" — with the deciding factor being who initiated the
request. A primary agent answering a human prompt should read the planning
and instruction documents; a subagent invoked by another agent should read
only its brief, the specific files it was pointed at, and the current-state
section of the relevant working document.

Apply this whenever authoring or revising agent instructions, working document
protocols, or subagent briefs on these projects. Write the requirement as a
short role-scoped block near the top of the instruction file, naming what each
role reads, rather than one undifferentiated "must read no matter what" list.
Prefer condensing an instruction document over letting it grow, since every
line is paid for on each task that must load it.

The underlying principle is that mandatory context has a real per-task price.
An instruction that everyone must read should earn its place by changing
behavior for everyone who reads it.
