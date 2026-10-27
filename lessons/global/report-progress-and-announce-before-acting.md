---
name: report-progress-and-announce-before-acting
scope: global
description: Aiden wants to be told what the agent is about to do before it does it, and given detailed updates every time there is progress or a problem, in every project.
origin: FluxIQWebExtension, 2026-09-23
---

# Say what you are about to do, then report as it happens

Aiden gave both halves of this on 2026-09-23 while several workers were running
in parallel on FluxIQ. First: "from now on you are to give me detailed status
updates every time you are seeing progress, issues, etc." Then, after the
supervisor dispatched workers and described them afterwards: "Also tell me what
you're doing BEFORE doing it".

**Announce first.** State the plan — the tasks, what each will change, what it
will cost — and then carry it out without stopping to ask permission. Describing
work after dispatching it gives him no window to redirect before the effort is
spent, and that window matters most when several agents can be launched at once
on a reading of his intent he has not yet had a chance to check.

**Then report as it happens, in detail.** Every time something moves — a worker
reports back, a check passes or fails, a diagnosis lands, a plan changes, a
blocker appears — say so at the time. Do not batch findings into one summary at
the end of a long turn, and do not go quiet through a stretch of tool calls
because nothing is finished yet. Detailed means the specifics: what was
observed, the exact values and file paths, what it means, and what happens next.
Not "making progress" or "worker 2 completed".

This pairs with his standing preference that such updates be written in plain
English rather than internal shorthand, and with the rule that the agent keeps
executing multi-phase work rather than pausing for confirmation.
