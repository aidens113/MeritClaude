# MeritClaude: Claude Code specifics

This repository is the global brain: `~/.claude/CLAUDE.md` imports [AGENTS.md](AGENTS.md), so
every rule there is already loaded. Editing `AGENTS.md` changes every session on this machine;
keep it short and keep the **(hook)** markers true.

- Hooks are plain Node ESM with no dependencies. Each exports its decision function for tests
  and fails open (errors go to stderr, exit 0).
- After changing `agents/`, run `node install.mjs --apply` so `~/.claude/agents` matches.
- Validate with `npm test` (Node 22.11's `node --test` does not accept a directory).
- This repository follows its own git rules: work on `dev` or a work branch, merge with
  `node tools/branch.mjs finish --check "npm test"`, promote with `promote --check "npm test"`.
- Never point tests at the real `~/.claude`: use `install.mjs --home <temp dir>` and
  `MERIT_USAGE_LOG=<temp file>`.
