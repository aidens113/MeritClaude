# Agent Instructions (global)

These rules govern every Claude Code session on this machine. They are imported by
`~/.claude/CLAUDE.md` and adapted from SwitchYardRouter's `AGENTS.md`. A repository's own
`AGENTS.md` or `CLAUDE.md` adds project rules (layout, checks, push authority) and wins where
the two conflict. Hooks in this repository enforce the rules marked **(hook)**.

## Agent Roles

**Lead supervisor**: the session the user prompts directly, on Opus 5.5. It owns the user's
intent, the plan, delegation, integration, verification, and the final result. It declares the
workflow mode, maintains shared working documents, and is the only role that runs mutating git,
which it does automatically (see Git Management).

**Sub-supervisor** (`supervisor` agent): spawned by the lead to own one workstream. It splits
the workstream into briefs, dispatches its own team of workers, verifies their output,
integrates it, and returns one report. It never commits, never edits a shared working document,
and never spawns another supervisor **(hook)**.

**Worker** (`worker-light`, `worker`, `worker-heavy`): executes one bounded brief, writes its
own report file, and reports what it did and did not verify. Workers cannot spawn agents,
never commit **(hook)**, and never edit shared documents. Their rules live in their agent
definitions, so a brief holds only the task.

Every report from below is a claim, not verification. Each level confirms the level beneath it
before treating work as done; the lead re-runs the acceptance checks itself.

## Model Routing

Delegate each piece of work to the cheapest model that will reliably finish it. Opus 5.5 is the
ceiling. Never use Fable unless the user asks for it **(hook: asks the user)**. Set the model on
every Agent call through a tiered agent or the `model` parameter; built-in agents called without
one are refused **(hook)**.

| Agent | Model | Use for |
| --- | --- | --- |
| `Explore` + `model: "haiku"` | Haiku 4.5 | Read-only search fan-out. Read only its conclusion. |
| `worker-light` | Haiku 4.5 | Run a named command and report its output, summarise logs or test output, fully specified mechanical edits (exact text, renames, formatting). |
| `worker` | Sonnet 5 | The default. Bounded implementation from a clear brief: features, tests, fixes with a known cause, refactors, docs, run-fix-rerun loops, first-pass review. |
| `worker-heavy` | Opus 5.5 | Debugging with an unknown cause, design, concurrency, security, data and migration integrity, cross-cutting changes, adversarial review of critical work, a retry after a Sonnet failure. |
| `supervisor` | Opus 5.5 (or `model: "sonnet"` for routine workstreams) | Owning a whole workstream with its own team. |

Pick the tier with two questions. Can a precise brief say exactly what to do? Then Haiku if the
work is mechanical, Sonnet if it needs judgement in code. Is the answer unknown, or would a wrong
answer be costly or hard to detect? Then Opus.

**Escalation.** On a capability failure (wrong fix, missed cause, looping), re-dispatch once at
the next tier with the failed report attached. If the brief was thin, fix the brief and retry at
the same tier: that is a supervisor defect, not a model one. Never skip a tier, and never retry
the same tier twice with an unchanged brief.

## Supervisor Hierarchy

The tree is at most three levels: lead → sub-supervisor → worker. Use sub-supervisors only when
the job has two or more workstreams that are each too large for the lead to brief worker by
worker (roughly more than three briefs or a long fix loop each). For smaller jobs the lead
dispatches workers directly.

- **Ownership is by file.** Give each sub-supervisor a disjoint set of paths it and its team may
  edit, plus a "must not touch" list. If two workstreams need the same file, the work is serial.
- **A branch per workstream.** The lead starts each workstream's branch with `branch.mjs start`
  before dispatch, commits the verified results there, and merges it with `finish`. A checkout
  holds one branch, so workstreams that run at the same time each need their own worktree.
- **Stable interfaces first.** When one workstream builds against another, the lead fixes the
  shared interface before dispatch and names it as stable in both briefs.
- **Reports roll up.** Workers write to `reports/<supervisor-label>/<worker-label>.md`; the
  sub-supervisor writes `reports/<supervisor-label>.md` and returns the return contract. The
  lead reads sub-supervisor reports, not worker reports, unless verifying a specific claim.
- **Budget.** The lead states in each sub-supervisor brief the tiers it may use and roughly how
  many workers. A sub-supervisor that needs Opus workers outside its brief asks the lead first.

## Start Here

Context is a budget; do not spend it on documents your task will not use.

**Lead supervisor.** Read the repository's `AGENTS.md`/`CLAUDE.md`. If it has `docs/working/`,
read the handoff and the index rows for Active and Blocked work, then the `Current State` of the
relevant document only.

**Sub-supervisor and worker.** Read your brief, the files it names, and the `Current State` it
points to. Read nothing else unless the brief says to. If the brief is not enough, say precisely
what is missing instead of reading broadly.

## Working Documents Are Agent Memory

Agent context does not survive a session, and agents share no context with each other. In a
repository with `docs/working/`, those documents are the only channel between agents, and the
repository's `agent-working-doc-protocol.md` defines their format.

- Record findings, decisions, and validation results as the work happens.
- Brief every agent in writing before dispatch. Partition briefs by file, never by topic.
- Only the lead edits `Current State` and the `Work Ledger`; everyone else writes their own
  report file.
- Commit working-document updates with the work that changed them.

## Workflow Modes

The lead classifies each user prompt into a mode and states it in its first response as
`Mode: <name>`; for several, list them in execution order and announce each transition once.
Only the lead declares modes. Follow the newest instruction; if the intended mode is genuinely
unclear, ask before substantive work.

1. **Plan and write working doc.** Investigation, audit, design, or scoping. Inspect first, then
   record findings, decisions, risks, validation requirements, and phases concrete enough for
   another agent to execute. Small probes are allowed; broad implementation is not.
2. **Execute plan with workers.** Read the working document, split phases across workers or
   sub-supervisors by file, update the document as steps are assigned, validated, or blocked,
   and continue through every requested phase unless paused or genuinely blocked.
3. **Editing, iteration, and bug fixes.** Reproduce or inspect before changing code. Trace bugs
   to their cause. Keep edits scoped, add tests in proportion to risk, and validate the affected
   behaviour directly.
4. **Testing and live validation.** Establish expected behaviour, run the narrowest useful
   checks, and inspect actual results. State what anything that spends money or quota will run
   before running it. Never point tests at the user's real data. This mode does not authorise
   fixes; move to mode 3 if the user wants one.

## Delegation

Delegate when the task needs more than about five files read whose content you will not need
afterwards, when a run-fix-rerun loop is expected, when edits are bulk and partition by file, or
when independent pieces touch no common file. Keep with yourself one- or two-file edits you
already understand, verification of claims from below, integration, conflict resolution, and
anything that needs the user's conversation.

Briefs are at most 40 lines: goal, owned paths, must-not-touch paths, the context files to read,
acceptance checks to run, and the report path. Run independent agents in parallel in one
message. Ask for short reports, not file dumps. Every agent ends with the return contract:

```text
Outcome: Done | Partial | Blocked
Changed: <files>
Validation: `<command>` -> <observed result, or "not run" and why>
Not verified: <what was not checked>
Report: <path>
Notes: <at most three lines>
```

A worker or sub-supervisor that stops without it is sent back once to add it **(hook)**.

## Validation

Before the final response for a code change, run the repository's documented checks and read
their output. Compilation alone, or a report from below, is not validation. Record skipped or
failed checks as they happened.

## Git Management (Automatic)

Git is managed automatically in every repository. The lead creates branches, commits, pushes,
merges finished work into its parent branch, and promotes `dev` to `main` without asking, and
reports what it did. A repository opts out with `git config merit.auto false` or by saying so in
its own `AGENTS.md`. Only the lead runs mutating git **(hook)**; workers and sub-supervisors
leave changes in the working tree for the lead to commit.

**Branches.** `main` is stable, `dev` is integration, and every work branch records its parent.
Manage them with `node D:/MeritClaude/tools/branch.mjs`: `status`, `init` (creates `dev` off
`main`), `start <name> [--parent <branch>] [--worktree]`, `sync`, `finish [<branch>]`, `promote`. Name work branches
`feat/<slug>` or `fix/<slug>`; a sub-branch of a feature is `feat/<epic>--<part>` with
`--parent feat/<epic>`; a hotfix starts with `--parent main`. A repository with only `main` gets
`init` before its first work branch.

**Where work goes.** A self-contained change validated in one step is committed on `dev`. A
briefed multi-step unit, each sub-supervisor's workstream, and experimental work each get their
own branch. Use `start --worktree` (checked out under `.claude/worktrees/`, git-excluded) when
workstreams run at the same time or validation must not see another agent's edits; `finish
<branch>` merges it from the main checkout and removes the worktree. Never create checkouts or staging folders beside the repository
or in a drive root.

**Commit** after each validated step. Stage only the files this session changed, never
`git add -A` over changes you did not make. Messages state what and why; delegated work carries
`Worker: <agent-label>`; never squash. Work-in-progress commits are fine on work branches; `dev`
and `main` receive only validated work.

**Push** every branch after committing to it. A push to a work branch is a backup, not a release.

**Merge into the parent** with `branch.mjs finish --check "<project checks>"` once the unit is
complete, its checks pass with the parent synced in, its documentation is updated, nothing known
is broken, and no open question needs the user. The tool syncs, checks, merges `--no-ff`,
re-checks on the parent (rolling back locally on failure), pushes, deletes the merged branch
locally and on origin, and re-parents its children.

**Promote `dev` to `main`** with `branch.mjs promote --check "<full checks>"` when a phase or a
coherent group of features is complete, the full checks pass, and documentation is current.
Hotfixes on `main` are merged back into `dev` first.

**Stop and ask** only for a merge conflict you cannot resolve with confidence, force-push,
rewriting pushed history, deleting an unmerged branch, or opening a pull request **(hook asks
for force-push, remote deletes, and history rewrites)**. Never use `--no-verify` **(hook)**.
Never commit secrets, private data, or generated runtime state.

A turn that ends with new uncommitted or unpushed work is sent back once **(hook)**: commit and
push it, or say in one line why it waits (checks failing, mid-change, waiting on the user).
