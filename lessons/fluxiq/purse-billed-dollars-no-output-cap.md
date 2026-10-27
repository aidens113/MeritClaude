---
name: purse-billed-dollars-no-output-cap
scope: fluxiq
description: FluxIQ's per-Flow spending ceiling counts the dollars the provider actually bills, and no request may cap the model's output to save purse.
origin: FluxIQWebExtension, 2026-10-03
---

# The purse counts billed dollars and never caps the model's output

The per-Flow purse counted every call at DeepSeek's peak, uncached price, and a
proposed fix capped replies at 1,000 tokens to shrink each call's hold. Aiden
answered: "It should be billed at how much it actually costs, and i never told you
to add any cap on output. Remove that."

The $0.10-per-Flow ceiling (one variable, `FLUXIQ_LLM_RUN_COST_CEILING_USD`) is
measured in what the provider really charges: the off-peak price when a call falls
in that window, and cached input at the cached rate, taken from the usage the
provider reports. No build, judge or repair request sends `max_tokens` or any other
limit on the reply. A hold placed before a call may estimate the reply, for example
at twice the longest reply observed for that call kind, and the purse still refuses
a call whose hold does not fit what is left; if a reply runs past its reservation,
the overshoot is recorded rather than prevented by truncation.

This matters because a capped reply silently degrades what the model can say and
costs a re-ask when it is cut, while a purse priced above the real bill stops builds
before they can repair. When cost and model freedom pull against each other, fix the
accounting (price only what is sent, reserve what is measured) rather than
constraining the model. The same principle backs the standing rules against caps on
what the model is shown and against action restrictions beyond permissions.
