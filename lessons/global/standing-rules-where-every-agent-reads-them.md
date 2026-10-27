---
name: standing-rules-where-every-agent-reads-them
scope: global
description: A standing user rule must be written where every agent reads it (the project's AGENTS.md or CLAUDE.md and each worker brief), and enforced mechanically where possible, never only in the supervisor's local auto-memory.
origin: FluxIQWebExtension, 2026-10-07/08
---

# Put standing user rules where every agent reads them

Aiden had stated a firm rule, angrily, weeks earlier: every Lab or browser test run,
live or provider-free, uses only the ten realistic scenarios. The rule lived only in
the supervisor's local auto-memory. On 2026-10-07/08 a lane lead ran a provider-free
check on a non-realistic fixture and a worker ran synthetic Playwright specs, because
neither agent could see the rule.

Spawned agents (leads and workers) do not load the supervisor's auto-memory; they read
the project instructions (AGENTS.md through CLAUDE.md), their brief and the files it
names. So when the user states or restates a standing rule, the supervisor must, in the
same turn: record it in memory as usual, write it into the project's AGENTS.md (or the
global brain when it applies to every project), and restate it in every brief whose
work it touches until the instruction file carries it. Where the rule can be checked by
code, also add a guard that refuses the violation (here, the Lab now refuses other
scenarios at every launch entry), because written guidance alone still depends on
someone reading it.

This matters because a broken standing rule costs the user's trust far more than the
task it was broken in, and the supervisor is accountable for its workers' behaviour.
Treat a rule that only the supervisor can see as unenforced. Edge case: rules about the
supervisor's own conduct (how it reports, when it asks) can stay in memory and the
brain; rules about how work is done belong where the workers doing it will read them.
