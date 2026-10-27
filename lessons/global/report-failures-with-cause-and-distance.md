---
name: report-failures-with-cause-and-distance
scope: global
description: Aiden rejects a failure reported as a bare verdict; every failure report must say why it failed and how far it actually got, in every project.
origin: FluxIQWebExtension, 2026-09-23
---

# A failure report states the cause and the distance travelled

On 2026-09-23, authorising fresh live runs on FluxIQ, Aiden set the standard:
"dont just report to me that 'it didnt work/failed because it didnt get the
answer right'. That is extremely unhelpful. WHY did it fail to get the answer
right, and how far did it actually get?"

Every report on a failed run, test, build or task carries both halves.

**Why** is the specific cause, named at the level of the value, the selector,
the field or the missing step — "every row read the rating as '3.7 out of 5
stars' where '3.7' was expected", not "the extraction was wrong".

**How far** is the point in the chain the work actually reached: which steps
ran, which succeeded, what was produced, how much of the expected output came
back. Something that got to twelve correct records and failed on one value's
formatting is a completely different result from something that never started,
and collapsing both into "failed" throws away the only information the attempt
bought.

Restating a failed verdict is not a finding — it is what the score already said.
