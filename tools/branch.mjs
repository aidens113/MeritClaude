#!/usr/bin/env node
// Automatic branch management for the lead supervisor (AGENTS.md "Git Management").
// Every branch records its parent in git config (branch.<name>.meritParent), so finished work
// merges back to the branch it came from: feat/* -> dev (or a parent feature), dev -> main.
//
//   node branch.mjs status
//   node branch.mjs init                       ensure dev exists off main; push both; switch to dev
//   node branch.mjs start <name> [--parent <branch>] [--worktree]
//        default parent: dev (main if no dev). --worktree checks the branch out in
//        .claude/worktrees/<name> and leaves the current checkout alone (concurrent workstreams).
//   node branch.mjs sync                       merge the parent into the current branch
//   node branch.mjs finish [<branch>] [--check <cmd>] [--title <text>] [--keep]
//   node branch.mjs promote [--from dev] [--to main] [--check <cmd>]
//
// finish: sync the parent into the branch, run --check there, merge --no-ff into the parent,
// re-run --check on the parent (rolling the merge back locally if it fails), push the parent,
// re-parent children, then remove the branch's worktree and delete the branch locally and on
// origin. It works wherever the branch and its parent are checked out. Conflicts abort and leave
// both branches untouched. Every checkout involved must have no uncommitted tracked changes.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

class Fail extends Error {}

function git(args, { cwd, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.error) throw new Fail(`git not runnable: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) throw new Fail(`git ${args.join(' ')} failed:\n${(r.stderr || r.stdout).trim()}`);
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
}
const out = (args, cwd) => git(args, { cwd }).out;
const tryOut = (args, cwd) => { const r = git(args, { cwd, allowFail: true }); return r.ok ? r.out : null; };
const ok = (args, cwd) => git(args, { cwd, allowFail: true }).ok;
const log = (line) => console.log(line);

const exists = (b) => ok(['show-ref', '--verify', '--quiet', `refs/heads/${b}`]);
const mainBranch = () => (exists('main') || !exists('master') ? 'main' : 'master');
const current = (cwd) => {
  const b = tryOut(['symbolic-ref', '--short', 'HEAD'], cwd);
  if (!b) throw new Fail('HEAD is detached; switch to a branch first.');
  return b;
};
const hasOrigin = () => out(['remote']).split(/\r?\n/).includes('origin');
const onOrigin = (b) => hasOrigin() && ok(['ls-remote', '--exit-code', '--heads', 'origin', b]);
const parentKey = (b) => `branch.${b}.meritParent`;
const samePath = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

function worktrees() {
  const list = [];
  for (const block of out(['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/)) {
    const path = block.match(/^worktree (.+)$/m)?.[1];
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null;
    if (path) list.push({ path, branch, main: list.length === 0 });
  }
  return list;
}
const worktreeOf = (b) => worktrees().find((w) => w.branch === b) ?? null;

function parentOf(b) {
  const recorded = tryOut(['config', '--get', parentKey(b)]);
  if (recorded) return recorded;
  const main = mainBranch();
  if (b === main) return null;
  if (b === 'dev') return main;
  return exists('dev') ? 'dev' : main;
}

function requireClean(cwd, label = 'this checkout') {
  const dirty = out(['status', '--porcelain', '--untracked-files=no'], cwd);
  if (dirty) throw new Fail(`Uncommitted changes to tracked files in ${label}; commit or stash them first:\n${dirty}`);
}

function fetch() {
  if (hasOrigin()) git(['fetch', '--prune', 'origin']);
}

// Fast-forward a local branch to origin, wherever it is checked out.
function updateFromOrigin(b) {
  if (!onOrigin(b)) return;
  if (out(['rev-parse', b]) === out(['rev-parse', `origin/${b}`])) return;
  if (!ok(['merge-base', '--is-ancestor', b, `origin/${b}`])) {
    if (ok(['merge-base', '--is-ancestor', `origin/${b}`, b])) return; // local is ahead
    throw new Fail(`${b} has diverged from origin/${b}; reconcile it before continuing.`);
  }
  const wt = worktreeOf(b);
  if (wt) git(['merge', '--ff-only', `origin/${b}`], { cwd: wt.path });
  else git(['fetch', 'origin', `${b}:${b}`]);
  log(`fast-forwarded ${b} to origin/${b}`);
}

function push(b) {
  if (!hasOrigin()) return log(`no origin remote; ${b} not pushed`);
  git(['push', '-u', 'origin', b]);
  log(`pushed ${b}`);
}

// Merge source into the branch checked out at cwd; abort cleanly on conflict.
function mergeInto(cwd, target, source, message) {
  const args = message ? ['merge', '--no-ff', '-m', message, source] : ['merge', '--no-edit', source];
  if (ok(args, cwd)) return;
  const conflicts = tryOut(['diff', '--name-only', '--diff-filter=U'], cwd) || '(unknown)';
  git(['merge', '--abort'], { cwd, allowFail: true });
  throw new Fail(`Merging ${source} into ${target} conflicts; merge aborted, nothing changed. Conflicting files:\n${conflicts}`);
}

function runCheck(cmd, cwd, label) {
  if (!cmd) return true;
  log(`running check on ${label}: ${cmd}`);
  return spawnSync(cmd, { cwd, shell: true, stdio: 'inherit' }).status === 0;
}

// Merge the parent into branch b, checked out at cwd.
function syncAt(cwd, b) {
  const p = parentOf(b);
  if (!p) throw new Fail(`${b} has no parent branch.`);
  requireClean(cwd, b);
  fetch();
  updateFromOrigin(p);
  const behind = Number(out(['rev-list', '--count', `${b}..${p}`]));
  if (behind === 0) return log(`${b} is up to date with ${p}`);
  mergeInto(cwd, b, p);
  log(`merged ${p} (${behind} commit${behind === 1 ? '' : 's'}) into ${b}`);
}

const commands = {
  status() {
    const branches = out(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).split(/\r?\n/).filter(Boolean);
    const head = tryOut(['symbolic-ref', '--short', 'HEAD']);
    const trees = worktrees();
    for (const b of branches) {
      const p = parentOf(b);
      const vs = p && exists(p) ? out(['rev-list', '--left-right', '--count', `${p}...${b}`]).split(/\s+/) : null;
      const rel = vs ? `parent ${p}: ${vs[1]} ahead, ${vs[0]} behind` : 'no parent';
      const upstream = tryOut(['rev-parse', '--abbrev-ref', `${b}@{upstream}`]);
      const unpushed = upstream ? Number(out(['rev-list', '--count', `${upstream}..${b}`])) : null;
      const pushState = upstream ? (unpushed ? `${unpushed} unpushed` : 'pushed') : 'not on origin';
      const wt = trees.find((w) => w.branch === b && !w.main);
      log(`${b === head ? '*' : ' '} ${b}  (${rel}; ${pushState}${wt ? `; worktree ${wt.path}` : ''})`);
    }
    const dirty = out(['status', '--porcelain']);
    if (dirty) log(`uncommitted:\n${dirty}`);
  },

  init() {
    const main = mainBranch();
    if (!tryOut(['rev-parse', '--verify', 'HEAD'])) throw new Fail('No commits yet; make the first commit on main, then run init.');
    if (!exists(main)) throw new Fail(`No ${main} branch.`);
    if (!exists('dev')) {
      git(['branch', 'dev', main]);
      log(`created dev from ${main}`);
    }
    git(['config', parentKey('dev'), main]);
    push(main);
    push('dev');
    if (current() === main) {
      git(['switch', 'dev']);
      log('switched to dev');
    }
  },

  start(name, opts) {
    if (!name) throw new Fail('usage: start <name> [--parent <branch>] [--worktree]');
    if (!ok(['check-ref-format', '--branch', name])) throw new Fail(`Invalid branch name: ${name}`);
    if (exists(name)) throw new Fail(`${name} already exists; switch to it instead.`);
    const p = opts.parent ?? (exists('dev') ? 'dev' : mainBranch());
    if (!exists(p)) throw new Fail(`Parent ${p} does not exist${p === 'dev' ? '; run init first' : ''}.`);
    fetch();
    updateFromOrigin(p);
    if (opts.worktree) {
      const top = out(['rev-parse', '--show-toplevel']);
      const path = join(worktrees()[0].path, '.claude', 'worktrees', name.replace(/[\\/]+/g, '-'));
      if (!ok(['check-ignore', '-q', path], top)) {
        const exclude = out(['rev-parse', '--git-path', 'info/exclude'], top);
        appendFileSync(resolve(top, exclude), '\n/.claude/worktrees/\n');
      }
      git(['worktree', 'add', '-b', name, path, p]);
      git(['config', parentKey(name), p]);
      return log(`started ${name} from ${p} in worktree ${path}`);
    }
    git(['switch', '-c', name, p]);
    git(['config', parentKey(name), p]);
    log(`started ${name} from ${p}`);
  },

  sync() { syncAt(process.cwd(), current()); },

  finish(name, opts) {
    const b = name ?? current();
    const main = mainBranch();
    if (b === main || b === 'dev') throw new Fail(`${b} is not a work branch; use promote to move dev into ${main}.`);
    if (!exists(b)) throw new Fail(`No branch ${b}.`);
    const p = parentOf(b);
    if (!exists(p)) throw new Fail(`Parent ${p} of ${b} does not exist.`);

    // Find or make a checkout of the branch.
    let bTree = worktreeOf(b);
    if (!bTree) {
      requireClean(process.cwd());
      git(['switch', b]);
      bTree = worktreeOf(b);
    }
    syncAt(bTree.path, b);

    let pDir = worktreeOf(p)?.path;
    let switched = false;
    const ahead = Number(out(['rev-list', '--count', `${p}..${b}`]));
    if (ahead === 0) log(`${b} has no commits beyond ${p}; nothing to merge`);
    else {
      if (!runCheck(opts.check, bTree.path, b)) throw new Fail(`Check failed on ${b}; nothing merged.`);
      if (!pDir) {
        git(['switch', p], { cwd: bTree.path });
        pDir = bTree.path;
        switched = true;
      }
      requireClean(pDir, p);
      const before = out(['rev-parse', 'HEAD'], pDir);
      const title = opts.title ?? b.replace(/^[^/]+\//, '').replace(/[-_]+/g, ' ');
      mergeInto(pDir, p, b, `Merge ${b}: ${title}`);
      if (!runCheck(opts.check, pDir, p)) {
        git(['reset', '--hard', before], { cwd: pDir });
        if (switched) git(['switch', b], { cwd: pDir });
        throw new Fail(`Check failed on ${p} after merging; merge rolled back locally, ${b} kept.`);
      }
      log(`merged ${b} into ${p}`);
      push(p);
    }

    const children = (tryOut(['config', '--get-regexp', '^branch\\..*\\.meritparent$']) ?? '')
      .split(/\r?\n/).filter((l) => l.endsWith(` ${b}`)).map((l) => l.split(' ')[0].replace(/^branch\.|\.meritparent$/gi, ''));
    for (const child of children) { git(['config', parentKey(child), p]); log(`re-parented ${child} onto ${p}`); }
    if (opts.keep) return log(`kept ${b}`);

    // Release the branch from its checkout, then delete it.
    const still = worktreeOf(b);
    if (still && !still.main) {
      git(['worktree', 'remove', still.path]);
      log(`removed worktree ${still.path}`);
    } else if (still) {
      git(['switch', p], { cwd: still.path });
    }
    git(['branch', '-d', b]);
    if (onOrigin(b)) git(['push', 'origin', '--delete', b]);
    log(`deleted merged branch ${b}`);
  },

  promote(_, opts) {
    const from = opts.from ?? 'dev';
    const to = opts.to ?? mainBranch();
    const start = current();
    requireClean(process.cwd());
    for (const b of [from, to]) {
      const wt = worktreeOf(b);
      if (wt && !samePath(wt.path, worktrees()[0].path)) throw new Fail(`${b} is checked out in worktree ${wt.path}; promote from the main checkout.`);
    }
    fetch();
    updateFromOrigin(to);
    updateFromOrigin(from);
    if (!ok(['merge-base', '--is-ancestor', to, from])) {
      git(['switch', from]);
      mergeInto(undefined, from, to);
      log(`merged ${to} into ${from} so ${to} can fast-forward`);
    }
    if (opts.check) {
      if (current() !== from) git(['switch', from]);
      if (!runCheck(opts.check, undefined, from)) throw new Fail(`Check failed on ${from}; ${to} not promoted.`);
    }
    git(['switch', to]);
    git(['merge', '--ff-only', from]);
    log(`fast-forwarded ${to} to ${from}`);
    push(to);
    push(from);
    git(['switch', start === to ? from : start]);
  },
};

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--keep' || rest[i] === '--worktree') opts[rest[i].slice(2)] = true;
  else if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i];
  else positional.push(rest[i]);
}
try {
  if (!commands[cmd]) throw new Fail(`usage: branch.mjs <${Object.keys(commands).join('|')}> ...`);
  commands[cmd](positional[0], opts);
} catch (error) {
  if (!(error instanceof Fail)) throw error;
  console.error(error.message);
  process.exit(1);
}
