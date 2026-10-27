---
name: flows-generalise-not-only-record
scope: fluxiq
description: A FluxIQ build may explore and record steps live, but must also be able, and be encouraged, to author general Flows (loops, row-bound steps, parameters) from what it gathered without running every iteration.
origin: FluxIQWebExtension, 2026-10-02
---

# Builds record what they explore and generalise what they learned

Aiden noticed the build model behaved as if it had to perform every action a Flow
would take in order to add it as a step. He corrected it: "The model should be ABLE
to explore & 'record'/test different node configurations, but it should also be
able/encouraged to build dynamic & smart flows from what its gathered without going
through every iteration." He then ordered the feature built before any further live
runs.

Both modes are required, side by side. Live exploration and recorded steps stay
valid: the model may run node configurations against the page to learn what works.
The model must also be able to write a general step, or lift a recorded one into
one, by binding its argument to the loop's current row, a Flow input, or an earlier
step's output, keeping the one instance it ran as evidence. Its instructions should
push it to generalise repetitive work, for example confirming one request live and
then authoring the loop over every matching row. Written steps still declare their
consequences so the money, delete and send/publish permission gate holds, and they
are tested the same way as recorded ones: part runs while building, and the one
judged whole-Flow run before the Flow is accepted.

This matters because a Flow made only of replays of concrete actions cannot
generalise: a loop whose body was recorded on one row clicks that same row on every
pass (lane D's confirm-requests run did exactly that), and a build that must perform
every iteration spends the per-Flow purse on repetition instead of on getting the
structure right. When judging a build change, ask whether it keeps recorded steps
working and whether it lets the model generalise without executing each instance.
