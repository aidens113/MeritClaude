---
name: build-has-three-phases
scope: family
description: On FluxIQ, a Flow build explores live while the model authors an intelligent draft, then tests and judges it, then repairs, finishes, or only if truly impossible declares it not doable; replays happen only in judgement and repair.
origin: FluxIQWebExtension and FluxIQ Core, 2026-09-30
---

# A build has three phases

Aiden watched live builds look at a page, act, then restart the Flow from the beginning and replay it over and over, and
called it "an extremely inefficient way of doing things". He set the lifecycle: (1) live exploration plus drafting of the
Flow in real time; (2) once the model says the Flow is ready, test it and judge its result; (3) repair it, or declare it
finished, or, "ONLY IF THERE IS ABSOLUTELY NO WAY TO ACHIEVE IT", declare it not doable and say why. He added that the draft
must not "BLINDLY ADD EACH STEP THAT IT TOOK ONE BY ONE IN ORDER", and that a replay from the start belongs "DURING THE
JUDGEMENT PHASE" or "during repair phase directly", never during exploration.

So the model authors the draft deliberately: a step it ran is evidence until it adds it; dead ends, failed attempts and
exploratory looks stay out; repeated work becomes a loop and sometimes-present interruptions become branches. Nothing in
the build loop replays the draft from its first step or forces a return to the start location. The model sees what it
must do as a checklist from the first decision, and progress means the Flow advanced, not that an action landed. A build
never just ends: an empty draft keeps exploring while budget remains, a budget hit says what was tried and what blocked
it, an unreadable model reply is asked again, and "not doable" is an explicit, evidenced decision.

Why: replays from the start burn time and money and can repeat lasting effects; a transcript draft is not a usable
automation; and a build that silently ends tells the person nothing.
