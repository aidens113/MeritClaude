// PreToolUse (Bash|PowerShell). Enforces AGENTS.md "Only the lead commits or pushes":
// - Any subagent (input has agent_type or agent_id) may run only read-only git commands, and
//   may not open or merge pull requests (`gh pr create|merge`).
// - Everyone: --no-verify is denied; force-push, remote deletes and history rewrites ask the user.
// Parsing is a guardrail, not a sandbox: it splits on shell separators and finds `git`
// tokens anywhere, including inside `bash -c "..."` and `$(...)`. The cost is false positives on
// quoted text such as `echo "git is ..."`, which only ever deny a subagent with an explanatory
// reason. Heredoc bodies are data, not commands: a worker writing a report with
// `cat > r.md <<'EOF'` may quote `git push` in prose; the line that opens the heredoc is kept.
import { decidePreToolUse, isMain, runHook } from './lib.mjs';

const READ_ONLY = new Set([
  'status', 'diff', 'log', 'show', 'blame', 'grep', 'ls-files', 'ls-tree', 'ls-remote',
  'rev-parse', 'rev-list', 'describe', 'shortlog', 'cat-file', 'merge-base', 'for-each-ref',
  'check-ignore', 'name-rev', 'show-ref', 'count-objects', 'whatchanged', 'range-diff',
  'help', 'version', '--version', '--help',
]);

// Subcommands that are read-only only in some forms.
const CONDITIONAL = {
  branch: (args) => !args.some((a) => /^(-[dDmMcCfu]|--(delete|move|copy|force|set-upstream-to|unset-upstream|edit-description))/.test(a))
    && args.every((a) => a.startsWith('-')),
  tag: (args) => args.length === 0 || args.every((a) => /^(-l|--list|-n\d*|--contains|--points-at|--sort.*|--format.*)$/.test(a)),
  remote: (args) => args.length === 0 || ['-v', '--verbose', 'show', 'get-url'].includes(args[0]),
  stash: (args) => ['list', 'show'].includes(args[0]),
  worktree: (args) => args[0] === 'list',
  config: (args) => args.some((a) => /^(--get|--get-all|--get-regexp|--list|-l)$/.test(a)),
  reflog: (args) => args.length === 0 || args[0] === 'show',
};

// Global options that take a separate value token.
const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

const GH_PR_WRITES = new Set(['create', 'merge']);

// `<<` or `<<-` with an optionally quoted word; `<<<` (a here-string) is not a heredoc.
const HEREDOC_OPEN = /(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/;
const FEEDS_SHELL = /(^|[\s;&|(\\/])((ba|z|da|k)?sh|pwsh|powershell|cmd)(\.exe)?(\s+-\w+)*\s*$/i;

export function stripHeredocs(command) {
  const kept = [];
  let terminator = null;
  for (const line of command.split(/\r?\n/)) {
    if (terminator !== null) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    kept.push(line);
    const open = HEREDOC_OPEN.exec(line);
    // A body fed to a shell is commands, not data: keep it scanned.
    if (open && !FEEDS_SHELL.test(line.slice(0, open.index))) terminator = open[2];
  }
  return kept.join('\n');
}

const segments = (command) => command.split(/&&|\|\||[;|\n]/);

function tokenize(segment) {
  return segment.split(/[\s`]+|\$\(/).map((t) => t.replace(/^[$<"'`({]+|["'`)}]+$/g, '')).filter(Boolean);
}

export function findGitInvocations(command) {
  const invocations = [];
  for (const segment of segments(command)) {
    const tokens = tokenize(segment);
    for (let i = 0; i < tokens.length; i++) {
      if (!/^(.*[\\/])?git(\.exe|\.cmd)?$/i.test(tokens[i])) continue;
      let j = i + 1;
      while (j < tokens.length && tokens[j].startsWith('-') && !['--version', '--help'].includes(tokens[j])) {
        j += GLOBAL_WITH_VALUE.has(tokens[j]) ? 2 : 1;
      }
      if (j >= tokens.length) continue;
      invocations.push({ sub: tokens[j], args: tokens.slice(j + 1) });
      i = j;
    }
  }
  return invocations;
}

function findGhPrWrite(command) {
  for (const segment of segments(command)) {
    const tokens = tokenize(segment);
    const at = tokens.findIndex((t) => /^(.*[\\/])?gh(\.exe)?$/i.test(t));
    if (at === -1) continue;
    const positional = tokens.slice(at + 1).filter((t) => !t.startsWith('-')).map((t) => t.toLowerCase());
    if (positional[0] === 'pr' && GH_PR_WRITES.has(positional[1])) return `gh pr ${positional[1]}`;
  }
  return null;
}

function isReadOnly({ sub, args }) {
  if (READ_ONLY.has(sub)) return true;
  return CONDITIONAL[sub]?.(args) ?? false;
}

export function evaluate(input) {
  const raw = input.tool_input?.command;
  if (typeof raw !== 'string') return null;
  const command = stripHeredocs(raw);
  // Claude Code sets agent_id on every subagent tool call; agent_type names its definition.
  const subagent = input.agent_type || (input.agent_id ? 'subagent' : null);
  // tools/branch.mjs runs git in its own process, out of this hook's sight.
  if (subagent && /branch\.mjs\W+(init|start|sync|finish|promote)\b/.test(command)) {
    return ['deny', `Subagents (${subagent}) may not manage branches; branch.mjs status is allowed. The lead supervisor creates, merges, and promotes branches.`];
  }
  const registryWrite = command.match(/\b(npm|pnpm|yarn)(\s+npm)?\s+(publish|unpublish|deprecate|dist-tag\s+(add|rm))\b/)
    ?? command.match(/branch\.mjs\W+publish\b/);
  if (registryWrite && !/--dry-run\b/.test(command)) {
    if (subagent) {
      return ['deny', `Subagents (${subagent}) never publish or change registry packages; the lead publishes through branch.mjs promote.`];
    }
    if (!/branch\.mjs/.test(registryWrite[0])) {
      return ['ask', 'Packages publish automatically through `branch.mjs promote` after checks pass. Approve this direct registry change only if the user asked for it.'];
    }
  }
  if (subagent && /\bgh\b/i.test(command)) {
    const pr = findGhPrWrite(command);
    if (pr) {
      return ['deny', `Subagents (${subagent}) may not run \`${pr}\`: the lead supervisor opens and merges pull requests. Report your changes instead.`];
    }
  }
  if (!/git/i.test(command)) return null;
  const invocations = findGitInvocations(command);
  if (invocations.length === 0) return null;

  for (const inv of invocations) {
    const noVerify = inv.args.includes('--no-verify') || (inv.sub === 'commit' && inv.args.includes('-n'));
    if (noVerify && ['commit', 'push', 'merge', 'am', 'rebase'].includes(inv.sub)) {
      return ['deny', 'AGENTS.md: never use --no-verify. If a hook fails, fix the cause.'];
    }
  }

  if (subagent) {
    const blocked = invocations.find((inv) => !isReadOnly(inv));
    if (blocked) {
      return ['deny', `Subagents (${subagent}) may run only read-only git commands; \`git ${blocked.sub}\` changes the index, branch, or history. Leave the change in the working tree and report it; the lead supervisor commits.`];
    }
    return null;
  }

  for (const inv of invocations) {
    if (inv.sub === 'push') {
      if (inv.args.some((a) => /^(-f|--force|--force-with-lease.*|--force-if-includes)$/.test(a) || /^\+/.test(a))) {
        return ['ask', 'Force-push needs explicit user approval every time (AGENTS.md).'];
      }
      if (inv.args.some((a) => /^(-d|--delete)$/.test(a) || /^:/.test(a))) {
        return ['ask', 'Deleting a remote branch or tag needs explicit user approval every time (AGENTS.md).'];
      }
    }
    if (inv.sub === 'filter-branch' || inv.sub === 'filter-repo') {
      return ['ask', 'History rewrites need explicit user approval every time (AGENTS.md).'];
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  runHook((input) => {
    const result = evaluate(input);
    if (result) decidePreToolUse(...result);
  });
}
