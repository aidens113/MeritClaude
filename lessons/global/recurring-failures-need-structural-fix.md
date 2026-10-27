---
name: recurring-failures-need-structural-fix
scope: global
description: When the same kind of failure keeps coming back in new shapes, Aiden wants the agent to stop patching each instance and propose and build the structural fix, in every project.
origin: FluxIQWebExtension, 2026-10-07
---

# Recurring failures call for a structural fix, not more patches

On 2026-10-07 Aiden said "we've been basically at the same point for 2 weeks" and "tiny things like exact node functionality shouldn't completely cripple the bot". Each live round had been debugged and the specific cause patched, yet the same family of failure (the model crediting an act to the wrong step) returned in a new shape every round, and small gaps in narrow tools kept ending whole runs.

When a failure belongs to a family that has already recurred after being patched, stop treating it as another instance. Say plainly that the patches are not converging, name the underlying design weakness, and propose a structural change: remove the thing that can go wrong (for example, derive a fact from evidence instead of trusting a label), add a general fallback so one narrow gap cannot end the work, or replace a pile of special-case rules with a few general ones. Write the plan down, get his direction, and build it; keep landing the point fixes already written meanwhile. Apply the same test to process problems that keep recurring.

Why it matters: per-instance fixes feel like progress but leave the system as fragile as before, so the next run fails a new way and time and money are spent without moving the goal. He judges progress by whether the product works, not by how many causes were fixed.
