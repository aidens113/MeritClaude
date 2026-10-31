---
name: lesson
description: Record a lesson in MeritPrompts at the global or family tier and update that tier's index. Use when the user states a standing preference or corrects an approach in a way that applies beyond the current repository.
argument-hint: <global|family> <slug>
---

Record a lesson at `{{MERITPROMPTS}}/lessons/$0/$1.md`. `$0` is `global` or a family name such
as `fluxiq`; `$1` is a short kebab-case slug. If the file already exists, update it rather than
creating a second one.

A lesson is worth recording only if it is applicable (it would change what you do next time),
durable (it applies beyond this task), and legible (a different agent could act on it). If it
fails one of those, say so and do not write it.

Write it in this shape, at most 40 lines, in connected full sentences that make sense without
the current session:

```text
---
name: $1
scope: $0
description: <one line: what the user wants and where it applies>
origin: <repository and date>
---

# <Title>

<What the user said or corrected, in one or two sentences.>

<The lesson: what to do differently, and in which situations it applies.>

<Why it matters, so a future agent can judge edge cases.>
```

Then regenerate the indexes with `node {{MERITPROMPTS}}/install.mjs --index`. It rewrites every
`lessons/*/INDEX.md` from the lesson files, one line each, `- [<Title>](<slug>.md): <description>`,
taking the title from the first `# ` heading and the description from the frontmatter, so never
edit an index by hand. Check `git -C {{MERITPROMPTS}} diff lessons` shows only this lesson's line
changing, and that `node {{MERITPROMPTS}}/install.mjs --check` reports no budget problem for the
lesson or its index. Global lessons load in every session; a family index loads only in
repositories whose `CLAUDE.md` imports `@{{MERITPROMPTS}}/lessons/<family>/INDEX.md`, so add that
import to the current repository if it belongs to the family and lacks it.

Commit in MeritPrompts under its git rules: work on `dev`, stage only the lesson and index, then
push:
`git -C {{MERITPROMPTS}} switch dev`, `git -C {{MERITPROMPTS}} add lessons/$0`,
`git -C {{MERITPROMPTS}} commit -m "Add lesson: $1"`, `git -C {{MERITPROMPTS}} push origin dev`.
If the MeritPrompts checkout has other uncommitted changes, commit only the lesson files.
