---
name: supervisor-pushes-dev-after-validation
scope: fluxiq
description: In every FluxIQ repository, the senior supervisor agent pushes each significant, validated feature to the dev branch on origin as soon as it lands, and the repository's agent instructions must say so.
origin: FluxIQWebExtension auto-memory, promoted 2026-09-10; extended in FluxIQWebsite, 2026-09-18
---

# The supervisor pushes each significant feature to dev on FluxIQ

Aiden asked that the senior supervisor agent push to the `dev` branch of the
FluxIQ repositories on its own when appropriate, rather than leaving commits
sitting locally and waiting to be told. While setting up the FluxIQWebsite
repository he restated it more strongly: the agent instructions (`AGENTS.md`,
imported by `CLAUDE.md`) must say that significant features are pushed to the
`dev` remote, and the supervisor must follow that itself.

This applies to every repository in the FluxIQ family — `FluxIQ`,
`FluxIQWebExtension`, and `FluxIQWebsite` — and to any new one, whose
`AGENTS.md` should state the rule when it is created. The cadence is per
feature: push after each completed plan phase, new or reworked section or
module, new check or script, or dependency change, instead of batching a
session's work into one push at the end. A push is due only when the change is
a complete unit and the relevant checks were actually run and observed to pass,
not merely compiled or reported successful by a worker.

This is a standing exception to asking before pushing, and it covers only
`dev`. It does not extend to `main`, to force pushes, to history rewrites, or to
deleting remote branches, all of which still need explicit approval each time.
Incomplete or failing work stays local, and the supervisor says plainly what it
pushed and what it did not. Only the supervisor commits and pushes; workers
never do, because a worker's completion report is not evidence that a change is
safe to publish. Frequent pushes matter because unpushed work is invisible to
Aiden and to agents in paired repositories, and one lost machine loses it all.
