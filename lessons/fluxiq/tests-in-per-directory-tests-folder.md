---
name: tests-in-per-directory-tests-folder
scope: fluxiq
description: On FluxIQ, tests live in a tests/ subfolder inside the directory that owns their subject — not loose beside the source, and not in a separate package-root tree mirroring src/.
origin: FluxIQWebExtension auto-memory, promoted 2026-09-10
---

# Tests live in a per-directory `tests/` subfolder on FluxIQ

Aiden first said tests "should go in a tests folder, not just the same
folder." I initially proposed a package-root `tests/` tree mirroring `src/`
(`src/a/b/thing.ts` ↔ `tests/a/b/thing.test.ts`). He corrected that: rather
than a separate mirrored tree, put a `tests/` folder *inside the final
directory where the source files live* and keep the tests there.

So the layout is `src/a/b/thing.ts` covered by `src/a/b/tests/thing.test.ts`.
A test is always one directory below its subject. A test with several
subjects lives in the `tests/` folder of the nearest directory containing all
of them. Test-only helpers go in the same `tests/` folders as non-`.test`
files. Shipped test support — anything re-exported from a public barrel or
imported by non-test code — remains ordinary source in `src/<area>/testing/`.

This applies to both the `FluxIQ` core repository and `FluxIQWebExtension`.
Do not propose the mirrored-root layout again, and do not co-locate test
files loose beside source. When writing agent instructions or structure
docs, describe the per-directory `tests/` subfolder.

Why it fits the rest of the structure rules: a `tests/` subfolder is a
directory, so it does not count toward the parent's 25-file cap, and it
self-limits because a directory with at most 25 source files has at most 25
one-to-one tests. It also removes a tsconfig complication the mirrored tree
had — tests stay under `src/**`, which `pnpm check` already includes, so only
the build exclude needs to name the `tests/` folders.
