# MeritPrompts: Claude Code specifics

Read AGENTS.md for shared policy. This guide applies only to Claude Code.

## Runtime policy

- The lead runs on Opus 5.5; sub-supervisors use the supervisor agent and workers use
  worker-light, worker, or worker-heavy. Their definitions live in agents/*.md.
- Hooks enforce hierarchy, model routing, worker git restrictions, report contracts,
  protected git/registry operations, and the final git checkpoint. The hook table in README.md
  names the exact events and limits; all hooks fail open on internal errors.
- Start with /resume and finish with /handoff, then /clear. Record reusable lessons with /lesson.
- Global rules and lessons are imported through ~/.claude/CLAUDE.md. Family lesson indexes
  use @file imports in project CLAUDE.md files. Local memory lives in
  ~/.claude/projects/<slug>/memory/ and CLAUDE.local.md.
- Dispatch in the foreground when the next step depends on the result; background completion
  does not wake a sub-supervisor.

## Model Routing

Delegate each piece of work to the cheapest model that will reliably finish it. Opus 5.5 is the
ceiling. Never use Fable unless the user asks for it **(hook: asks the user)**. Set the model on
every Agent call through a tiered agent or the `model` parameter; built-in agents called without
one are refused **(hook)**.

| Agent | Model | Use for |
| --- | --- | --- |
| `Explore` + `model: "haiku"` | Haiku 5.5 | Read-only search fan-out. Read only its conclusion. |
| `worker-light` | Haiku 5.5 | Run a named command and report its output, summarise logs or test output, fully specified mechanical edits (exact text, renames, formatting). |
| `worker` | Sonnet 5.5 | The default. Bounded implementation from a clear brief: features, tests, fixes with a known cause, refactors, docs, run-fix-rerun loops, first-pass review. |
| `worker-heavy` | Opus 5.5 | Debugging with an unknown cause, design, concurrency, security, data and migration integrity, cross-cutting changes, adversarial review of critical work, a retry after a Sonnet failure. |
| `supervisor` | Opus 5.5 (or `model: "sonnet"` for routine workstreams) | Owning a whole workstream with its own team. |

Pick the tier with two questions. Can a precise brief say exactly what to do? Then Haiku if the
work is mechanical, Sonnet if it needs judgement in code. Is the answer unknown, or would a wrong
answer be costly or hard to detect? Then Opus.

**Escalation.** On a capability failure (wrong fix, missed cause, looping), re-dispatch once at
the next tier with the failed report attached. If the brief was thin, fix the brief and retry at
the same tier: that is a supervisor defect, not a model one. Never skip a tier, and never retry
the same tier twice with an unchanged brief.

## Maintaining MeritPrompts

The following checks apply when editing this repository:

- Hooks are plain Node ESM with no dependencies. Each exports its decision function for tests
  and fails open (errors go to stderr, exit 0).
- After changing `agents/`, run `node install.mjs --apply` so `~/.claude/agents` matches.
- Validate with `npm test` (Node 22.11's `node --test` does not accept a directory).
- This repository follows its own git rules: work on `dev` or a work branch, merge with
  `node tools/branch.mjs finish --check "npm test"`, promote with `promote --check "npm test"`.
- Never point tests at the real `~/.claude`: use `install.mjs --home <temp dir>` and
  `MERIT_USAGE_LOG=<temp file>`.
