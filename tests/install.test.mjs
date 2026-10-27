// The installer's --index, --check, and retired-agent removal, run as a child process against a
// temp copy of this repository (so lesson and budget fixtures never touch the real one) and a
// temp home (never the real ~/.claude).   node --test tests/install.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const LESSON = (name, scope, title, description) => [
  '---', `name: ${name}`, `scope: ${scope}`, `description: ${description}`, 'origin: test, 2026-10-27', '---', '',
  ...(title ? [`# ${title}`, ''] : []), 'Body text.', '',
].join('\n');

// A copy of the parts of the repository the installer reads, with fixture lessons in place of
// the real ones, plus an empty home. Both are removed when the test ends.
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'meritclaude-install-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const home = join(root, 'home');
  mkdirSync(home);
  for (const part of ['install.mjs', 'AGENTS.md', 'agents', 'skills']) cpSync(join(REPO, part), join(repo, part), { recursive: true });
  mkdirSync(join(repo, 'lessons', 'global'), { recursive: true });
  mkdirSync(join(repo, 'lessons', 'fam'), { recursive: true });
  writeFileSync(join(repo, 'lessons', 'global', 'b-second.md'), LESSON('b-second', 'global', 'Second lesson', 'What the second one says.'));
  writeFileSync(join(repo, 'lessons', 'global', 'a-first.md'), LESSON('a-first', 'global', 'First lesson', '"Quoted description, in every project."'));
  writeFileSync(join(repo, 'lessons', 'fam', 'no-title.md'), LESSON('no-title', 'fam', null, 'A lesson with no heading.'));
  const run = (...args) => spawnSync(process.execPath, [join(repo, 'install.mjs'), '--home', home, ...args], { encoding: 'utf8' });
  return { repo, home, run };
}

test('--index writes one exact line per lesson under the heading and intro', (t) => {
  const { repo, run } = fixture(t);
  writeFileSync(join(repo, 'lessons', 'global', 'INDEX.md'), 'stale\n');
  const r = run('--index');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Lesson indexes written for: fam, global/);
  assert.equal(readFileSync(join(repo, 'lessons', 'global', 'INDEX.md'), 'utf8'), [
    '# Global lessons',
    '',
    'Standing preferences and corrections that apply to every repository. One line per lesson; read',
    'the lesson file only when its line is relevant. Maintained by `/lesson`.',
    '',
    '- [First lesson](a-first.md): Quoted description, in every project.',
    '- [Second lesson](b-second.md): What the second one says.',
    '',
  ].join('\n'));
  assert.equal(readFileSync(join(repo, 'lessons', 'fam', 'INDEX.md'), 'utf8'),
    '# Lessons for the fam family\n\n- [no-title](no-title.md): A lesson with no heading.\n');
});

test('--index keeps an existing index heading and intro and replaces only the entries', (t) => {
  const { repo, run } = fixture(t);
  const index = join(repo, 'lessons', 'fam', 'INDEX.md');
  writeFileSync(index, '# Fam lessons\n\nAbout the fam family.\n\n- [Gone](gone.md): removed lesson\n');
  assert.equal(run('--index').status, 0);
  assert.equal(readFileSync(index, 'utf8'), '# Fam lessons\n\nAbout the fam family.\n\n- [no-title](no-title.md): A lesson with no heading.\n');
});

test('the real global index matches the format --index produces for its own lessons', () => {
  const index = readFileSync(join(REPO, 'lessons', 'global', 'INDEX.md'), 'utf8').replace(/\r\n/g, '\n');
  const lines = index.split('\n');
  assert.equal(lines[0], '# Global lessons');
  for (const line of lines.filter((l) => l.startsWith('- '))) assert.match(line, /^- \[[^\]]+\]\([a-z0-9-]+\.md\): \S/);
});

test('--check passes after --apply and an index refresh, and writes nothing', (t) => {
  const { home, run } = fixture(t);
  assert.equal(run('--index').status, 0);
  const applied = run('--apply');
  assert.equal(applied.status, 0, applied.stderr);
  const before = readdirSync(home).sort();
  const r = run('--check');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /MeritClaude check passed/);
  assert.deepEqual(readdirSync(home).sort(), before);
});

test('--check on an empty home reports drift and stale indexes, exits 1, and writes nothing', (t) => {
  const { home, run } = fixture(t);
  const r = run('--check', '--apply');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MeritClaude check failed/);
  assert.match(r.stderr, /lessons\/global\/INDEX\.md is stale; run: node install\.mjs --index/);
  assert.match(r.stderr, /lessons\/fam\/INDEX\.md is stale/);
  assert.match(r.stderr, /would write .*CLAUDE\.md/);
  assert.match(r.stderr, /would write .*settings\.json/);
  assert.deepEqual(readdirSync(home), [], '--check never applies, even with --apply');
});

test('--check reports an edited installed copy and over-budget files', (t) => {
  const { repo, home, run } = fixture(t);
  assert.equal(run('--index').status, 0);
  assert.equal(run('--apply').status, 0);
  writeFileSync(join(home, 'agents', 'worker.md'), 'edited by hand\n');
  writeFileSync(join(repo, 'AGENTS.md'), 'line\n'.repeat(500));
  writeFileSync(join(repo, 'lessons', 'global', 'a-first.md'), LESSON('a-first', 'global', 'First lesson', 'd') + 'x\n'.repeat(60));
  const r = run('--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /would write .*agents[\\/]worker\.md/);
  assert.match(r.stderr, /AGENTS\.md: 500 lines exceeds the \d+-line budget/);
  assert.match(r.stderr, /lessons\/global\/a-first\.md: \d+ lines exceeds the 40-line budget/);
  // Budgets ran against the repository, not the home: the drift line is the only home problem.
  assert.equal(r.stderr.split('\n').filter((l) => l.includes('drift: ')).length, 1, r.stderr);
});

test('retired brain agents are listed on a dry run, then backed up and removed', (t) => {
  const { home, run } = fixture(t);
  mkdirSync(join(home, 'agents'));
  const retired = ['lead.md', 'lead-xhigh.md', 'worker-low.md', 'worker-high.md'];
  for (const name of retired) writeFileSync(join(home, 'agents', name), `old ${name}\n`);
  writeFileSync(join(home, 'agents', 'mine.md'), 'a user agent\n');

  const dry = run();
  assert.equal(dry.status, 0, dry.stderr);
  for (const name of retired) {
    assert.match(dry.stdout, new RegExp(`remove retired agent .*${name.replace('.', '\\.')}`));
    assert.ok(existsSync(join(home, 'agents', name)), 'dry run removes nothing');
  }
  assert.ok(!existsSync(join(home, 'backups')), 'dry run creates no backups directory');

  assert.equal(run('--apply').status, 0);
  for (const name of retired) assert.ok(!existsSync(join(home, 'agents', name)), name);
  assert.ok(existsSync(join(home, 'agents', 'mine.md')), 'other agents are left alone');
  assert.ok(existsSync(join(home, 'agents', 'worker-light.md')));
  const backups = readdirSync(join(home, 'backups'));
  for (const name of retired) {
    const copy = backups.find((b) => b.startsWith(`agents_${name}.`));
    assert.ok(copy, `backup of ${name} in ${backups}`);
    assert.equal(readFileSync(join(home, 'backups', copy), 'utf8'), `old ${name}\n`);
  }

  const again = run('--apply');
  assert.match(again.stdout, /nothing to change/);
});
