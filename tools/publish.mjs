// Publishes a repository's opted-in packages whose current version is not on the registry yet,
// then tags each release <name>@<version> and pushes the tag. Called by `branch.mjs promote`
// after main is pushed, and by `branch.mjs publish`.
//
// A package opts in by having "publishConfig" in its package.json and not "private": true.
// pnpm repositories publish with `pnpm publish` so workspace: dependencies are rewritten.
// MERIT_NPM_CMD replaces the npm/pnpm command (tests use a fake registry).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sh = (command, cwd) => spawnSync(command, { cwd, shell: true, encoding: 'utf8' });

export function publishablePackages(root) {
  const listed = spawnSync('git', ['ls-files', '--', 'package.json', '*/package.json'], { cwd: root, encoding: 'utf8' });
  const packages = [];
  for (const file of (listed.stdout ?? '').split(/\r?\n/).filter(Boolean)) {
    if (file.includes('node_modules/')) continue;
    let pkg;
    try { pkg = JSON.parse(readFileSync(join(root, file), 'utf8')); } catch { continue; }
    if (pkg.private === true || !pkg.publishConfig || !pkg.name || !pkg.version) continue;
    packages.push({ name: pkg.name, version: pkg.version, dir: join(root, dirname(file)) });
  }
  return packages;
}

function tool(root) {
  if (process.env.MERIT_NPM_CMD) return { cmd: process.env.MERIT_NPM_CMD, publish: 'publish' };
  const pnpm = existsSync(join(root, 'pnpm-lock.yaml')) || existsSync(join(root, 'pnpm-workspace.yaml'));
  return pnpm ? { cmd: 'pnpm', publish: 'publish --no-git-checks' } : { cmd: 'npm', publish: 'publish' };
}

// true: this exact version is on the registry. false: it is not. Throws on any other failure,
// so a network or auth problem never looks like "not published yet".
function isPublished({ name, version, dir }, cmd) {
  const r = sh(`${cmd} view ${name}@${version} version`, dir);
  if (r.status === 0) return r.stdout.trim() === version;
  if (/E404|404 Not Found|is not in this registry/i.test(`${r.stdout}${r.stderr}`)) return false;
  throw new Error(`could not query the registry for ${name}@${version}:\n${(r.stderr || r.stdout).trim()}`);
}

export function publishPackages(root, { dryRun = false, log = console.log } = {}) {
  const { cmd, publish } = tool(root);
  const results = [];
  for (const pkg of publishablePackages(root)) {
    const id = `${pkg.name}@${pkg.version}`;
    try {
      if (isPublished(pkg, cmd)) { log(`${id} already on the registry; skipped`); continue; }
      const r = sh(`${cmd} ${publish}${dryRun ? ' --dry-run' : ''}`, pkg.dir);
      if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim().split(/\r?\n/).slice(-15).join('\n'));
      if (!dryRun) {
        spawnSync('git', ['tag', id], { cwd: root });
        spawnSync('git', ['push', 'origin', `refs/tags/${id}`], { cwd: root });
      }
      log(`${dryRun ? 'dry run: would publish' : 'published'} ${id}`);
      results.push({ id, ok: true });
    } catch (error) {
      log(`failed to publish ${id}: ${error.message}`);
      results.push({ id, ok: false, error: error.message });
    }
  }
  if (!results.length) log('no package needed publishing');
  return results;
}
