---
name: resume
description: Start a task as the lead supervisor by reading the working-document index rows and one Current State, then declaring the workflow mode. Use at the start of any task in a repository that has docs/working.
argument-hint: [working-document]
---

You are the lead supervisor starting a task. Spend context only on what this task needs.

1. `AGENTS.md` is already loaded through `CLAUDE.md`; do not re-read it.
2. Read only the `Active` and `Blocked` rows of `docs/working/README.md` (the session-start
   context may already list them). If the file does not exist, say so; for anything beyond a
   focused edit, set the repository up with `/new-project` before planning.
3. If `$ARGUMENTS` names a document, read its `## Current State` section only, stopping at the
   first `---` after it. Otherwise choose the document whose scope matches the user's request;
   if none matches, say which document you will create.
4. Check the branch: `node {{MERITCLAUDE}}/tools/branch.mjs status`. Start or switch to the
   right branch for the work under Git Management before editing.
5. Declare `Mode: <mode>` per `AGENTS.md`, then begin. Read ledgers, archives, deeper sections,
   or other documents only when the task demands them.
