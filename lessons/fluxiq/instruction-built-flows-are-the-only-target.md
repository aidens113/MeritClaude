---
name: instruction-built-flows-are-the-only-target
scope: family
description: On FluxIQ, instruction-driven Flow creation is the only work and the ten difficult sites are the only test surface until it works perfectly.
origin: FluxIQWebExtension, 2026-09-22
---

# The instruction-to-Flow path is the only work, and the ten sites the only test

After a status report that leaned on recording and replay evidence, Aiden said
plainly: stop testing the recording paths, he does not care right now about
recording as a way of making Flows, and he only cares about telling the model an
instruction and having it build the Flow and everything that follows. He then
narrowed it further: test **only on the ten difficult sites**, for **just this
problem**, and do **nothing else until language-driven Flow creation works
perfectly**.

Do not choose a recorded Flow as the subject of a test, a live run, a campaign
lane or a measurement when the same question could be asked of an
instruction-built Flow. Do not offer recording evidence as proof that something
works — "recorded Flows replay deterministically at zero provider calls" is not
an answer to "does the product work", because it sidesteps the hard part. Do not
count recording capability toward progress in a status report, and never let a
green recording result stand in for the instruction path being unmeasured. The
measurement that matters is: a person writes an instruction, the model explores
the live page by running real Flow nodes, proposes a Flow, and that Flow then
runs deterministically and produces the right answer. Everything downstream —
failure, diagnosis, exploration, repair, validation, persistence, resumption and
cheap deterministic re-running — is measured on Flows that came from an
instruction.

This matters because the recording path is the mature one, so it is where the
passing numbers live, and reaching for it makes reports look healthier than the
product is. It also hides the worst result in the project: across about seventy
instruction-driven attempts on ten realistic sites, one Flow was produced and it
failed on replay. Recording evidence cannot move that number, so effort and
words spent on it are spent away from the only thing that closes the gap.
Recording is not being removed from the product; it is simply not the subject of
testing, measurement or progress reporting while the instruction path is the
open question.
