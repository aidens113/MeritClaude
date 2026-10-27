# FluxIQ lessons

Lessons for the FluxIQ repositories (Core and its downstream domains). One line per lesson; read
the lesson file only when its line is relevant. Maintained by `/lesson`.

- [A build has three phases](build-has-three-phases.md): On FluxIQ, a Flow build explores live while the model authors an intelligent draft, then tests and judges it, then repairs, finishes, or only if truly impossible declares it not doable; replays happen only in judgement and repair.
- [Changes that belong in Core go in Core](core-changes-go-in-core.md): On FluxIQ, a change that belongs to the Core framework is made in FluxIQ Core, never approximated, copied, or worked around in a downstream domain repository.
- [Builds record what they explore and generalise what they learned](flows-generalise-not-only-record.md): A FluxIQ build may explore and record steps live, but must also be able, and be encouraged, to author general Flows (loops, row-bound steps, parameters) from what it gathered without running every iteration.
- [The instruction-to-Flow path is the only work, and the ten sites the only test](instruction-built-flows-are-the-only-target.md): On FluxIQ, instruction-driven Flow creation is the only work and the ten difficult sites are the only test surface until it works perfectly.
- [The model sees the whole page, compactly](model-sees-whole-page.md): On FluxIQ, the model gets a compact view of every visible-text or interactive element plus a search over the rest; no caps or ranking, and never raw element JSON.
- [Nodes retry automatically everywhere (3 retries by default)](nodes-retry-automatically-everywhere.md): In FluxIQ every node action gets its first attempt plus 3 automatic retries on every execution path, waiting for its target first; only a lasting act whose effect is uncertain is held back, and a build never gives up on a recoverable failure.
- [The purse counts billed dollars and never caps the model's output](purse-billed-dollars-no-output-cap.md): FluxIQ's per-Flow spending ceiling counts the dollars the provider actually bills, and no request may cap the model's output to save purse.
- [The supervisor pushes each significant feature to dev on FluxIQ](supervisor-pushes-dev-after-validation.md): In every FluxIQ repository, the senior supervisor agent pushes each significant, validated feature to the dev branch on origin as soon as it lands, and the repository's agent instructions must say so.
- [Tests live in a per-directory `tests/` subfolder on FluxIQ](tests-in-per-directory-tests-folder.md): On FluxIQ, tests live in a tests/ subfolder inside the directory that owns their subject — not loose beside the source, and not in a separate package-root tree mirroring src/.
