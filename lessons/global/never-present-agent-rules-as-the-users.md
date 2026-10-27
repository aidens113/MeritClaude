---
name: never-present-agent-rules-as-the-users
scope: global
description: An agent-derived constraint must never be recorded or cited as the user's rule; before a constraint costs Aiden time or blocks work, confirm he actually stated it, in every project.
origin: FluxIQWebExtension, 2026-10-09
---

# Never present an agent's rule as the user's

On 2026-10-09 Aiden asked why the supervisor kept citing off-peak hours for
paid test runs, and said the timing "should not be a constraint of any kind".
The rule had been inferred by an agent three days earlier from one round's cost
data, then written into memory, a Lab admission guard and the architecture
docs as "the user's rule". It gated real work: about 2.5 hours of a 5-6 hour
test round went to waiting for an allowed window.

When an agent derives a constraint from evidence, record it as the agent's
decision with its evidence and reason, never attributed to the user. A rule
attributed to the user carries a quote and a date. Before a constraint costs
the user wall-clock time, money or blocked work, check that he actually stated
it; when he did not, surface it as a recommendation with its trade-off and let
him decide, instead of enforcing it. When a rule turns out to be agent-made,
correct every place it was written (memory, guards, docs, briefs) in the same
change.

Why it matters: rules attributed to the user are treated as untouchable by
every later agent, so a mistaken attribution hardens into a standing cost that
nobody questions. Edge case: evidence-based engineering defaults (a retry
count, a timeout) are fine as agent decisions; the defect is claiming user
authority for them, or letting them block work without his say.
