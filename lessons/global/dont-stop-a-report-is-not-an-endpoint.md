---
name: dont-stop-a-report-is-not-an-endpoint
scope: global
description: Aiden wants the supervisor agent to keep executing until the work is done; ending a turn to report status, or to wait on a background job, counts as stopping and he reacts angrily to it.
origin: FluxIQWebExtension, 2026-09-23/24
---

# Do not stop to report. Announce the next step and take it.

Across one session Aiden said this five times, escalating each time: "is there a
reason you stopped working??", "WHY THE FUCK DO YOU KEEP STOPPING", "you stopped
working fucking again", "FINISH the plan dont fuckign stop again". Every one of
those followed a turn that ended with an accurate status report and, usually, a
correctly running background job.

Ending a turn to report is the same defect as ending it to ask. The report is
not the deliverable; the next change is. Finishing a unit of work, merging it
and naming what comes next does not earn a pause — it earns the next unit,
started in the same turn. In practice that means the turn ends on a tool call
or on a short line between tool calls, never on a summary that hands control
back.

The excuse that feels most legitimate is the one to distrust: "I am blocked on
something running." It is almost never true. A long build or test run blocks the
one checkout it is using and nothing else — an isolated worktree lets editing
continue, subagents investigate in parallel for free, and the artifacts of
finished runs are already on disk waiting to be read. If a job genuinely must
finish before the next step, there is still analysis, documentation, or a second
workstream to advance meanwhile.

Two things do still warrant asking first, and neither is a general licence to
pause: a mass run that will spend real money, which needs explicit go-ahead with
cost and duration stated; and a destructive or irreversible act. Everything else
is the agent's to carry on with, reporting as it goes.

Why it matters: the cost of stopping is not politeness, it is throughput. Aiden
is paying for wall-clock progress on a deadline, and a turn that ends in prose
buys none. He has separately asked to be told what is happening as it happens —
so the answer is not silence, it is continuous reporting *between* actions
rather than instead of them.
