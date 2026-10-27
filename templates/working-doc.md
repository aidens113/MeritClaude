# <Effort Title>

Status: Active
Status detail: <one sentence of nuance: why it is paused, what blocks it, what remains>
Created: YYYY-MM-DD
Last updated: YYYY-MM-DD
Owner: <role, agent, or area>
Scope: <one or two lines: what this effort covers and what it deliberately does not>
Paired document: <path to the same document in the paired repository, or "none">
Related: <links to the instructions, architecture, or sibling documents an agent will need>

<!-- Template: copy to docs/working/<effort-slug>.md, fill in the header block
     (each field on one line), then run
     `node <MeritClaude>/tools/working-docs-audit.mjs --update` to add it to the
     index in the same work unit. The section order below is fixed: Current
     State first, reference sections, worker briefs, the ledger, open questions. -->

---

## Current State

<!-- Required, authoritative, under 150 lines, rewritten in place rather than
     appended to. Answer, for an agent with no prior context: what is true now,
     what is done, what is not done, what is next, what is blocked. If this
     section and a ledger entry disagree, this section wins. -->

## <Reference Section>

<!-- The stable material the effort is built on: objective, design, ownership,
     invariants, phases. Add as many of these sections as the work needs, and
     keep each one about a single subject so it can be revised or archived on
     its own. -->

## Worker Briefs

<!-- One brief per agent, written before dispatch, in the shape of
     MeritClaude's templates/brief.md. Delete this section until the first
     dispatch. -->

## Work Ledger

<!-- Append one entry per completed unit of work, newest last, each under 15
     lines and in this shape. The Validation line records the command that ran
     and what it actually printed; "worker reported success" is not a
     validation result. If nothing was run, write "not validated" and why. -->

### YYYY-MM-DD — <short title>
- Agent: <supervisor | worker label>
- Changed: <files or modules>
- Why: <one or two lines>
- Validation: `<exact command>` -> <actual observed result>
- Outcome: Accepted | Partial | Reverted | Blocked
- Follow-up: <next action, or "none">

## Open Questions

<!-- One bullet per unresolved decision, each naming who owns it and what
     would settle it. Remove a bullet when the decision is recorded above. -->
