---
name: handoff
description: End a task as the lead supervisor by rewriting Current State, appending a validated ledger entry, updating the index, recording lessons, then committing and merging or pushing under the git rules. Use when a unit of work is complete or the session is ending.
---

You are the lead supervisor ending a task. Do every step in order; do not skip to the commit.

1. **Verify.** Run the checks the change warrants and read their output. A skipped step or a
   failure goes into the ledger as it happened; never write "passed" for a check you did not
   run or did not observe.
2. **Working document.** Rewrite `## Current State` in place, under 150 lines: what is true
   now, done, not done, next steps, blockers. Append one `## Work Ledger` entry in the protocol
   format; its `Validation` line quotes the exact command and what it printed. Update
   `Last updated` and `Status detail` in the header. If the document passed 800 lines, compact
   per the protocol before anything else.
3. **Index and audit.** If `package.json` has a `structure:baseline` script, the repository's
   structure audit owns `docs/working/README.md`: run `pnpm structure:baseline`, then
   `pnpm structure:check`, and never run the MeritClaude audit there (its index format differs).
   Otherwise regenerate the index with
   `node {{MERITCLAUDE}}/tools/working-docs-audit.mjs --update`, then run it again without
   `--update` and confirm it prints `working-docs: passed`; fix any finding it prints.
4. **Lessons.** If the user corrected you or stated a standing preference that applies beyond
   this repository, record it with `/lesson <global|family> <slug>`. If the same lesson also
   landed in auto-memory as pinned, set `pinned: false` there so it costs one index line.
5. **Commit.** Stage the working document with the code it describes, and only files this
   session changed. Commit with a message stating what and why. Never use `--no-verify`.
6. **Merge or push** under Git Management in the global `AGENTS.md` and any override in the
   repository's own `AGENTS.md`: on a finished work branch run
   `node {{MERITCLAUDE}}/tools/branch.mjs finish --check "<checks>"`; otherwise push the branch.
   If the repository holds pushes until checks pass, say what holds it.
7. **Finish** with two lines: `Git: <what was committed, merged, and pushed, or what is held and why>`
   and `Next: /clear, then /resume <document>`.
