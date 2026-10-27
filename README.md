# MeritClaude

Global agent rules, agent definitions, and hooks for Claude Code on this machine. It replaces
the retired `F:/!AgentBrain` brain. One Opus 5.5 lead supervisor owns the high-level work and
delegates to teams that run on the cheapest model that will reliably finish each task, with the
rules enforced by configuration and hooks rather than by prompt text alone.

```text
Lead supervisor (main session, Opus 5.5)
├── supervisor (Opus 5.5, or Sonnet 5 for routine workstreams)   ← owns one workstream
│   ├── worker-light (Haiku 4.5)    mechanical: run a command, summarise, exact edits
│   ├── worker       (Sonnet 5)     default: bounded implementation from a clear brief
│   ├── worker-heavy (Opus 5.5)     unknown cause, design, security, data, critical review
│   └── Explore + model "haiku"     read-only search
└── workers / Explore directly, for jobs too small to need a sub-supervisor
```

## Contents

| Path | What it is |
| --- | --- |
| [AGENTS.md](AGENTS.md) | The global rules: roles, model routing, supervisor hierarchy, workflow modes, delegation, commits. Imported by `~/.claude/CLAUDE.md`. |
| [agents/](agents/) | `supervisor`, `worker-light`, `worker`, `worker-heavy`. Each pins its model and effort in frontmatter. |
| [hooks/](hooks/) | Enforcement and telemetry hooks (below). |
| [tools/branch.mjs](tools/branch.mjs) | Automatic branch management: records each branch's parent, merges finished work back with checks, promotes `dev` to `main`. |
| [tools/usage-report.mjs](tools/usage-report.mjs) | Token totals by the model each subagent actually ran on. |
| [install.mjs](install.mjs) | Wires all of the above into `~/.claude`. |
| [tests/](tests/) | Runs every hook as Claude Code does, plus the installer against a temp home. |

## Hooks

| Hook | Event | Does |
| --- | --- | --- |
| [git-guard](hooks/git-guard.mjs) | PreToolUse `Bash\|PowerShell` | Subagents may run only read-only git and `branch.mjs status`. Everyone: `--no-verify` denied; force-push, remote deletes, and `filter-repo`/`filter-branch` ask the user. |
| [agent-guard](hooks/agent-guard.mjs) | PreToolUse `Agent\|Task` | Denies built-in agents (`Explore`, `Plan`, `general-purpose`, `claude`) called without `model`; asks before any Fable use; denies a supervisor spawning a supervisor and workers spawning anything. |
| [report-guard](hooks/report-guard.mjs) | SubagentStop | Sends a worker or supervisor back once if its final message lacks the return contract. Never loops. |
| [usage-ledger](hooks/usage-ledger.mjs) | SubagentStop | Appends agent type, spawn depth, models used, and tokens per model to `~/.claude/merit/usage.ndjson`. |
| [git-checkpoint](hooks/git-checkpoint.mjs) | SessionStart, Stop | Adds a one-line git summary at session start. Sends the lead back once when a turn ends with new uncommitted or unpushed work. Ignores changes that predate the session. |
| [session-context](hooks/session-context.mjs) | SessionStart | In repositories with `docs/working/`, adds the handoff pointer and Active/Blocked index rows to the lead's context. Silent elsewhere. |

Every hook fails open: an internal error is reported as a non-blocking hook error and never
stops the session.

Settings the installer applies alongside the hooks:

- `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`: any agent without a model runs on Sonnet, not Opus.
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2`: lead → supervisor → worker, and no deeper.
- `modelSettings["claude-sonnet-5"].effortLevel = "medium"`, so Sonnet subagents do not inherit
  the global `xhigh`. Haiku 4.5 does not support effort levels; Opus 5.5 stays at `high`.

## Git management

Git is automatic by default (see [AGENTS.md](AGENTS.md#git-management-automatic)). `main` is
stable, `dev` is integration, and each work branch records its parent in
`branch.<name>.meritParent`:

```bash
node tools/branch.mjs init                          # dev off main, both pushed
node tools/branch.mjs start feat/login              # parent dev
node tools/branch.mjs start feat/login--form --parent feat/login --worktree
node tools/branch.mjs finish --check "npm test"     # sync, check, merge --no-ff, push, delete
node tools/branch.mjs finish feat/login--form       # from the main checkout; removes the worktree
node tools/branch.mjs promote --check "npm test"    # fast-forward main to dev, push both
node tools/branch.mjs status
```

`promote` then publishes to npm every package that has `publishConfig`, is not `private`, and
has a version not yet on the registry, and tags it `<name>@<version>`
([tools/publish.mjs](tools/publish.mjs); pnpm repositories use `pnpm publish`). Preview with
`node tools/branch.mjs publish --dry-run`.

### npm setup on this machine

1. On npmjs.com: **Access Tokens → Generate New Token → Granular Access Token** with read and
   write access to your packages (and your org, if you publish under one) and the option to
   bypass two-factor authentication, because automated publishes cannot answer a one-time-password
   prompt. Note the expiry date.
2. In your own PowerShell (keep the token out of agent sessions):
   `[Environment]::SetEnvironmentVariable('NPM_TOKEN', '<token>', 'User')`, then restart VS Code.
3. `~/.npmrc` contains `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`, so the token itself is
   never written to disk. Check with `npm whoami`.

A failing check or a conflict leaves both branches as they were. To turn automation off for one
repository, run `git config merit.auto false` there.

## Install

```bash
node install.mjs            # dry run: lists every change
node install.mjs --apply    # backs up to ~/.claude/backups/, then applies
```

The installer copies the agent files rather than linking them, so re-run it after editing
`agents/`. Edits to `AGENTS.md` and `hooks/` take effect immediately because Claude Code reads
them from this repository. Re-running is idempotent.

## Verify

```bash
npm test        # hooks, installer, and branch automation against throwaway repositories
node tools/usage-report.mjs --since 2026-10-26
```

After installing, start a new session and dispatch one trivial task to each tier. Then run the
usage report: each tier should appear under its model (`claude-haiku-4-5…`, `claude-sonnet-5`,
`claude-opus-5-5`), and the report lists any tiered agent that ran on an unexpected model.

## Known limits

- Hook inputs carry no model field, so the usage ledger reads the subagent's transcript.
  Input and cache tokens are exact. Transcripts record output tokens only when streaming
  starts, so output is estimated from the content written (`output_est`, about 4 characters
  per token).
- `git-guard` parses commands heuristically. It catches `git` inside `bash -c "..."`, at the
  cost of occasionally denying quoted text such as `echo "git is ..."` from a subagent.
- The `handoff`, `resume`, `lesson`, and `new-project` skills in `~/.claude/skills/` still
  reference `F:/!AgentBrain` paths and need moving here.
