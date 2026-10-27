---
name: schedule-estimates-not-padded
scope: global
description: Aiden wants plan schedules cut for parallel agent lanes with each date's real constraint named, never padded serial estimates, in every project.
origin: FluxIQ web extension and FluxIQ Core, 2026-10-18
---

# Schedule estimates are cut for parallel lanes, never padded

On 2026-10-18 a planning lead's hosted-production plan estimated about 80 agent-days of work, with a hosted
sign-in gate around 2026-11-28 and a Chrome Web Store submission around 2026-12-01. Aiden replied: "Regarding
your timeline, I'm pretty confident its incorrect. We'll be able to finish faster than that."

When a plan, a status report or a brief gives a schedule, estimate it the way the work is actually run: several
agents in parallel lanes, each partitioned by file, with integration rounds between them. Say what genuinely
forces each date (a dependency on another unit, a review, an external wait such as store approval or DNS), and
let everything else run concurrently. Present the estimate as an aggressive plan with its named risks, not as a
cautious total of serial agent-days. This applies to every plan that states effort or dates, and to any answer
to "how long will this take".

It matters because Aiden runs many agents at once, so a serial estimate misstates what is achievable and pushes
release dates out for no reason; a date that a real constraint forces is still stated plainly, and an unknown is
named as a risk rather than hidden as padding.
