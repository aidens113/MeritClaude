---
name: let-running-agents-reach-natural-endpoint
scope: global
description: When Aiden asks to wrap up while subagents or leads are working, let each reach its natural endpoint and integrate it, never interrupt them; record any still running at handoff so the next session can resume them; in every project.
origin: FluxIQWebExtension, 2026-10-19
---

# Let running agents reach their natural endpoint at wrap-up

On 2026-10-19, with a lane lead and several workers mid-task, Aiden said: "wrap it up with these agent tasks for now
when they are at a natural endpoint. don't interrupt them". Later he asked for a handoff to a new chat while one lead
was still working.

The lesson: a request to wrap up is not a request to stop work in flight. Do not stop, cancel or message running
subagents to cut them short, and do not start new lanes or paid runs. As each one finishes, verify its result, commit
it, and integrate it if its checks pass, exactly as during normal work. Do the rest of the wrap-up (working documents,
ledgers, commits, push) while they run. If a handoff must happen before an agent finishes, leave its work untouched
on its branch and record in the working document what it was doing, where its report and sub-reports are, what had
finished, what remained, and how the next session should pick it up (verify and integrate if done, or resume a lead
from its report if it stopped).

Why: interrupting a worker mid-change leaves half-edited files and loses the reasoning it had built up, which costs
more to recover than the minutes saved. Read-only work the user asks for during a wrap-up can still be dispatched
at once ([parallelize-partitionable-work-dont-serialize](parallelize-partitionable-work-dont-serialize.md)). A paid run
in flight still follows [ask-before-stopping-paid-run-at-wrap-up](ask-before-stopping-paid-run-at-wrap-up.md).
