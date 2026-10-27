---
name: core-changes-go-in-core
scope: fluxiq
description: On FluxIQ, a change that belongs to the Core framework is made in FluxIQ Core, never approximated, copied, or worked around in a downstream domain repository.
origin: FluxIQWebExtension (downstream web-extension repository), 2026-09-11
---

# Changes that belong in Core go in Core

During the web extension's MVP Week 1 work the supervisor had shipped or
planned downstream stand-ins for gaps in FluxIQ Core, and the user answered:
"just ensure that changes that should be going in core arent going in this
repo." The stand-ins were a failure code carried in a result's metadata
because Core's gateway result had no failure carrier, a domain-local copy of
the failure-category list "until Core's lands", and a deep import of Core's
build output kept because Core's package exports offered no CommonJS entry.

When downstream work reaches a gap in Core — a missing contract field or enum
member, a packaging or loading defect, a flaw in a script mirrored from Core —
make the change in Core (`F:\!FluxIQ`), pulling that Core step earlier in the
plan if needed, and have the downstream code consume Core's public exports. Do
not ship a downstream stand-in, a local copy of Core's types or names, or a
comment that explains a workaround in place of the fix. The cross-repository
rules still hold: alert the user before the first Core edit, follow Core's own
agent instructions there, and push both `dev` branches in the same work unit.

A downstream stand-in becomes a second source of truth that silently drifts
from Core, and deferring the Core change leaves a known structural problem in
place. The ownership test is the one the repositories already use: behaviour
that stays coherent after removing every domain concept (browser, DOM, URL,
selector, tab, extension) belongs in Core, while producing a domain-specific
value for a Core-owned field stays downstream.
