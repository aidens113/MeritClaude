---
name: enforce-standards-mechanically-dont-defer
scope: global
description: Aiden rejects deferring known structural problems or security weaknesses and wants engineering standards enforced by checks that fail the build rather than by written guidance.
origin: FluxIQWebExtension auto-memory, promoted 2026-09-10
---

# Enforce standards mechanically on FluxIQ, and do not propose deferral

When a 12,482-line class was found in FluxIQ Core, I recommended recording
the decomposition plan but deferring the work, on the grounds that the MVP
cycle's own rules discourage refactoring that is not currently blocking
anything. Aiden rejected that: "I dont want to just ignore this issue and
hope for the best. a 12k line file is unacceptable." He asked instead for a
full audit, a concrete division plan, and a hard limit actually implemented.

The lesson has two parts. First, do not offer "defer it and revisit later"
as the recommended path for a known structural defect on these projects,
even when a documented rule appears to justify waiting. Present the work and
a safe sequence for doing it. Deferral may still be the right call for a
specific risky step, but it should not be the headline recommendation.

The same holds for security weaknesses found in passing. In September 2026,
while designing an encrypted dataset column, the supervisor found that FluxIQ
Core derives keys from passwords with Node's default scrypt cost, below OWASP's
minimum, and logged it as "outside this plan's phases." Aiden called that
unacceptable and asked for the fix inside the plan. Plan and fix a weakness
found while working as part of the current effort; never park it as out of scope.

Second, prefer enforcement over documentation. The FluxIQ `AGENTS.md`
already forbade accumulating unrelated functionality in catch-all files, and
that instruction was in force for every commit during which the class grew
to 419 methods. Written guidance was therefore demonstrably ineffective as a
control. When proposing how to hold a standard, reach for a check wired into
`pnpm check` that fails the build, with a ratcheted baseline so existing
violations are frozen rather than requiring a large refactor before the
guard can be switched on.
