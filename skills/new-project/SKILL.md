---
name: new-project
description: Lay down the agent instruction files and working-document scaffolding for a repository that does not have them yet, from the MeritClaude templates.
disable-model-invocation: true
---

Set up the current repository for the lead supervisor / worker system.

1. Check what exists: `CLAUDE.md`, `AGENTS.md`, `docs/working/`. Never overwrite an existing
   file; report it and skip it.
2. Copy from `{{MERITCLAUDE}}/templates/`:
   - `CLAUDE.md` to the repository root. Replace its MeritClaude path placeholder (the word
     MERITCLAUDE in double braces) with `{{MERITCLAUDE}}`. If this repository belongs to a family with lessons under
     `{{MERITCLAUDE}}/lessons/<family>/`, keep the family import and set the family name;
     otherwise delete that line and its comment.
   - `AGENTS.md` to the repository root.
   - `agent-working-doc-protocol.md` and `docs-working-README.md` (renamed to `README.md`) into
     `docs/working/`. Replace `<YYYY-MM-DD>` with today's date.
   - Leave `working-doc.md`, `brief.md`, and `worker-report.md` in the templates; the lead
     copies them when an effort, a dispatch, or a report needs one.
3. Fill every `<!-- PROJECT: ... -->` placeholder in `AGENTS.md` and `CLAUDE.md` by inspecting
   the repository: its name and purpose, package layout, check/test/build commands, what must
   never be committed, and any boundary with a sibling repository. Remove placeholders that do
   not apply rather than leaving them.
4. Run `node {{MERITCLAUDE}}/tools/working-docs-audit.mjs --update` from the repository root
   to regenerate the index, then run it again without `--update` and confirm it prints
   `working-docs: passed`.
5. Git: if the repository is not a git repository, ask before running `git init`. Otherwise run
   `node {{MERITCLAUDE}}/tools/branch.mjs init` once the files are committed, so `dev` exists.
6. Report what was created, what was skipped because it existed, and which `AGENTS.md`
   sections still need the user's input.
