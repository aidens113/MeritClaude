# MeritPrompts

Shared working rules for **Claude Code and Codex**: supervisor/worker roles, scoped delegation,
working documents, reusable lessons, validation, and automatic git management. Each runtime
has its own guide, model routing, and installation path.

## Runtime support

| Capability | Claude Code | Codex |
| --- | --- | --- |
| Shared policy | [AGENTS.md](AGENTS.md) | [AGENTS.md](AGENTS.md) |
| Runtime guide | [CLAUDE.md](CLAUDE.md) | [CODEX.md](CODEX.md) |
| Global instructions | Imports shared policy, Claude guide, and lessons through `~/.claude/CLAUDE.md` | Snapshot of shared policy, Codex guide, and lessons in `$CODEX_HOME/AGENTS.md` (default `~/.codex`) |
| Worker setup | Installed agent definitions pin Claude models and effort | Routing instructions use available Codex agent controls; no worker definitions installed |
| Enforcement | Hooks for model routing, hierarchy, reports, and git | Shared policy followed through Codex tools; no enforcement hooks installed |
| Handoffs and lessons | `/resume`, `/handoff`, `/lesson`, `/new-project` skills | Read and update working documents and lessons directly |
| Telemetry | Subagent token ledger and instruction-file metrics | No telemetry installed |
| Shared tools | Branch management, publishing, working-document audit | Same tools |

## Model routing

| Responsibility | Claude Code | Codex |
| --- | --- | --- |
| Lead supervisor | Opus 5.5 | `gpt-6.1-sol` / Max |
| Sub-supervisor | Opus 5.5; Sonnet 5.5 for routine workstreams | `gpt-6.1-sol` / High |
| Discovery and mechanical work | Explore with Haiku; worker-light on Haiku 5.5 | `gpt-6-luna` / High |
| Implementation and tests | worker on Sonnet 5.5 / Medium | `gpt-6.1-sol` / Medium |
| Difficult debugging and critical review | worker-heavy on Opus 5.5 / High | `gpt-6.1-sol` / Max |
| Visual inspection and writing | Assign the appropriate Claude worker tier | `gpt-6.1-terra` / Medium |

**Codex ceiling: GPT-6.1 Sol Max. Astra is prohibited for every role, fallback, and review.**
Runtime guides contain escalation and availability rules. Explicit user selections and runtime
restrictions apply. Select the lead using the client's model controls; installing instructions
does not change the running model.

## Shared workflow

The lead owns the user's intent, scoped briefs, integration, verification, and mutating git
operations. Workers return reports and never commit. The lead verifies those reports before
integrating the work. Use sub-supervisors only for workstreams large enough to need a team.

In projects with `docs/working/`, read the handoff and relevant `Current State` before work,
record decisions and observed checks, and update the handoff when finished. Claude skills
assist this lifecycle; Codex performs the same document work directly.

## Contents

AGENTS.md contains runtime-neutral policy. [CLAUDE.md](CLAUDE.md) owns Claude model routing,
hooks, imports, commands, and memory paths; [CODEX.md](CODEX.md) owns Codex configuration and
instruction loading. The Claude installer imports shared policy plus CLAUDE.md; the Codex
snapshot includes shared policy plus CODEX.md, with no Claude model-routing instructions.
The model guides remain separate; shared policy does not embed either runtime's configuration.

| Path | What it is |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Shared roles, workflow, delegation, memory, validation, and git policy for both runtimes. |
| [CLAUDE.md](CLAUDE.md) | Claude models, agents, hooks, imports, commands, and local memory. |
| [CODEX.md](CODEX.md) | Codex runtime adaptations, referenced explicitly by AGENTS.md and included in the Codex install. |
| [agents/](agents/) | Claude `supervisor`, `worker-light`, `worker`, `worker-heavy` definitions with pinned models and effort. |
| [hooks/](hooks/) | Claude enforcement and telemetry hooks (below). |
| [skills/](skills/) | Claude `/resume`, `/handoff`, `/lesson`, `/new-project` skills with this checkout's path filled in. |
| [templates/](templates/) | Project `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, briefs, reports, and working-document scaffolding. |
| [lessons/](lessons/) | Shared global and family lessons; Claude imports indexes and Codex reads relevant lesson files explicitly. |
| [tools/branch.mjs](tools/branch.mjs) | Automatic branch management: records each branch's parent, merges finished work back with checks, promotes `dev` to `main`. |
| [tools/usage-report.mjs](tools/usage-report.mjs) | Claude subagent token totals by actual model. |
| [tools/working-docs-audit.mjs](tools/working-docs-audit.mjs) | Audits and regenerates `docs/working/` in repositories without a structure audit of their own (`--update` rewrites the index). |
| [install.mjs](install.mjs) | Installs Claude configuration or a Codex snapshot with `--codex`; checks drift and regenerates lesson indexes. |
| [tests/](tests/) | Claude hooks, both installers, git/release tools, and document audits using throwaway fixtures. |

## Claude Code hooks and settings

These hooks and settings apply only to Claude Code.

| Hook | Event | Does |
| --- | --- | --- |
| [git-guard](hooks/git-guard.mjs) | PreToolUse `Bash\|PowerShell` | Subagents may run only read-only git and `branch.mjs status`, and never `gh pr create`/`merge`; git quoted inside a heredoc body is text unless the body is fed to a shell. Everyone: `--no-verify` denied; force-push, remote deletes, and `filter-repo`/`filter-branch` ask the user. |
| [agent-guard](hooks/agent-guard.mjs) | PreToolUse `Agent\|Task` | Denies built-in agents (`Explore`, `Plan`, `general-purpose`, `claude`) called without `model`; asks before any Fable use; denies a supervisor spawning a supervisor and workers spawning anything. |
| [report-guard](hooks/report-guard.mjs) | SubagentStop | Sends a worker or supervisor back once if its final message lacks the return contract or its `Report:` names no existing file (`inline` is accepted). Never loops. |
| [usage-ledger](hooks/usage-ledger.mjs) | SubagentStop | Appends agent type, spawn depth, models used, and tokens per model to `~/.claude/merit/usage.ndjson`. |
| [git-checkpoint](hooks/git-checkpoint.mjs) | SessionStart, Stop | Adds a one-line git summary at session start. Sends the lead back once when a turn ends with new uncommitted or unpushed work, asking for `/handoff` too when working documents changed; offers `/clear` after a handoff. One Stop yields at most one send-back or note. Ignores changes that predate the session. |
| [session-context](hooks/session-context.mjs) | SessionStart | In repositories with `docs/working/`, adds the handoff pointer, Active/Blocked index rows (status column or `## Active`/`## Blocked` sections), uncommitted working documents, and the `/resume` hint. At most 15 lines; silent elsewhere. |
| [instruction-metrics](hooks/instruction-metrics.mjs) | InstructionsLoaded | Appends each loaded instruction file's size (never its content) to `~/.claude/merit/instructions.ndjson`, to measure what the always-loaded context costs. |

Every hook fails open: an internal error is reported as a non-blocking hook error and never
stops the session.

Settings the installer applies alongside the hooks:

- `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`: any agent without a model runs on Sonnet, not Opus.
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2`: lead → supervisor → worker, and no deeper.
- `modelSettings["claude-sonnet-5-5"].effortLevel = "medium"`, so Sonnet subagents do not inherit
  the global `xhigh`. Haiku and Opus keep their own settings (`worker-heavy` and `supervisor` set `high`).

## Git management for both runtimes

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

### npm release setup

1. On npmjs.com: **Access Tokens → Generate New Token → Granular Access Token** with read and
   write access to your packages (and your org, if you publish under one) and the option to
   bypass two-factor authentication, because automated publishes cannot answer a one-time-password
   prompt. Note the expiry date.
2. In your own PowerShell (keep the token out of agent sessions):
   `[Environment]::SetEnvironmentVariable('NPM_TOKEN', '<token>', 'User')`, then restart VS Code.
3. `~/.npmrc` contains `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`, so the token itself is
   never written to disk. Check with `npm whoami`.

A failed merge check rolls back the local merge. Publication happens after branch pushes, so
an npm authentication failure does not undo promotion. To promote without a release, use
`node tools/branch.mjs promote --no-publish --check "npm test"`. To opt a repository out of
automatic git management, run `git config merit.auto false` there.

## Install

Requires Node.js 22 or later. Run these commands from the checkout. Both installers preview
changes by default, back up replaced files when applying, and can be rerun safely.

### Claude Code

```bash
node install.mjs            # dry run: lists every change
node install.mjs --apply    # backs up to ~/.claude/backups/, then applies
node install.mjs --check    # budgets, stale lesson indexes, drift; exit 1 on any problem
```

The installer copies the agent files rather than linking them, so re-run it after editing
`agents/` or `skills/`. Shared rules, the Claude guide, and hooks are read from this checkout;
keep it available at its installed path.

### Codex

```bash
node install.mjs --codex          # preview Codex global instruction snapshot
node install.mjs --codex --apply  # back up and install into CODEX_HOME or ~/.codex
node install.mjs --codex --check  # check Codex snapshot drift without writing
codex -m gpt-6.1-sol              # select Max effort through /model
```

Codex installation writes only `AGENTS.md` in its home, combining the shared policy, Codex
adapter, and global lesson index. It leaves `config.toml`, credentials, skills, and agent
configuration untouched. Use `--home <directory>` to override the target for either runtime.
Reinstall Codex guidance after source edits and start a new session. `AGENTS.override.md`, if
present, takes precedence and is preserved. Project templates include a `CODEX.md` pointer
in `AGENTS.md`; Codex does not automatically discover `CODEX.md` or expand Claude imports.
See [official instruction discovery documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

The routing table is guidance for dispatch through available agent controls. Installation does
not register worker agents or switch the running lead model. Select GPT-6.1 Sol and Max effort
in the CLI, app, or IDE before starting work.

### Shared maintenance

Refresh lesson indexes after editing lesson files:

```bash
node install.mjs --index
```

The repository and npm CLI are now named `MeritPrompts` / `meritprompts` (previously
`MeritClaude` / `meritclaude`). The remote is `https://github.com/aidens113/MeritPrompts.git`.
Existing local checkout directories can keep their names; installation uses the actual path.
This version's npm publication is blocked by registry authentication; use the checkout commands
above until it is published. The packaged CLI forwards `meritprompts install --codex --apply`
for Codex and `meritprompts install --apply` for Claude Code.

## Verify

```bash
npm test        # both installers, Claude hooks, git/release tools, and document audits
node tools/working-docs-audit.mjs
```

Tests use throwaway homes and repositories. They check Codex configuration preservation,
Sol Max routing, and exclusion of Claude routing from Codex snapshots. They do not invoke paid
models or prove live agent dispatch.

For Claude, start a new session and dispatch a trivial task to each tier. Run the usage report
and confirm each tier used its configured model:

```bash
node tools/usage-report.mjs --since 2026-10-30
```

For Codex, run the snapshot drift check, start a new session, and inspect the active shared
policy and Codex guide. Confirm GPT-6.1 Sol at Max through the client's model controls. Check
actual worker selection through the runtime when delegation is available; the Claude usage
report does not measure Codex sessions.

## Known limits

- Codex support provides instructions and shared tools; it does not install Claude hooks,
  telemetry, slash skills, or agent definitions into Codex.
- Codex instructions are copied snapshots; Claude instruction imports point to this checkout.

- Claude hook inputs carry no model field, so the usage ledger reads the subagent's transcript.
  Input and cache tokens are exact. Transcripts record output tokens only when streaming
  starts, so output is estimated from the content written (`output_est`, about 4 characters
  per token).
- `git-guard` parses commands heuristically. It catches `git` inside `bash -c "..."`, at the
  cost of occasionally denying quoted text such as `echo "git is ..."` from a subagent.
