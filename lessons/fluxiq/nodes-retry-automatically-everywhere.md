---
name: nodes-retry-automatically-everywhere
scope: fluxiq
description: In FluxIQ every node action gets its first attempt plus 3 automatic retries on every execution path, waiting for its target first; only a lasting act whose effect is uncertain is held back, and a build never gives up on a recoverable failure.
origin: FluxIQWebExtension and FluxIQ Core, 2026-10-07
---

# Nodes retry automatically everywhere (3 retries by default)

Aiden watched a live candidate trial fail because a click ran right after a navigation,
found nothing yet, and was not retried; the build then refused a re-test and gave up. He
said nodes are supposed to retry automatically, even while exploring, or at least not
just give up, and set the default at 3 retries.

Every node execution path in FluxIQ (exploration's run-node and discovery actions,
mid-build tests, candidate trials, saved-Flow playback) uses one retry policy with one
owner: wait for the target to be present, visible, enabled and the page settled, then
act; retry a transient failure (not found yet, detached, covered, intercepted, a busy
refusal, a failed read-back on a non-lasting step) up to 3 times; report every attempt.
A lasting act (a committing press such as add to cart, send or confirm, or any step with
declared consequences) is retried only when nothing was dispatched or an effect check
shows it did not land; an undeterminable effect ends uncertain instead of pressing again.
Optional steps that cannot be done are passed without spending recovery budget. A build
re-tests a transiently failed trial, tells the model how to recover from every refusal,
and stops early only on the same refusal repeated.

This matters because a first-attempt timing failure is a product defect that turns paid
live runs into noise, while a repeated lasting act can double a purchase or a message.
New node types and new execution paths must join the shared policy, with tests that pin
the default (a late target succeeds before the third retry; a missing one fails after
exactly four attempts).
