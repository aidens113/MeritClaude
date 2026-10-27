// Stand-in for npm/pnpm in tests: `view <name>@<version> version` and `publish [--dry-run]`
// against a JSON file of published ids (FAKE_REGISTRY). FAKE_FAIL=<name> makes publishing that
// package fail; FAKE_DOWN=1 makes every registry query fail like a network error.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = process.env.FAKE_REGISTRY;
const published = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
const [command, target] = process.argv.slice(2);

if (process.env.FAKE_DOWN) {
  console.error('npm ERR! code ECONNREFUSED');
  process.exit(1);
}
if (command === 'view') {
  if (published.includes(target)) { console.log(target.slice(target.lastIndexOf('@') + 1)); process.exit(0); }
  console.error('npm ERR! code E404');
  process.exit(1);
}
if (command === 'publish') {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (process.env.FAKE_FAIL === pkg.name) { console.error('npm ERR! code E403 forbidden'); process.exit(1); }
  if (!process.argv.includes('--dry-run')) writeFileSync(file, JSON.stringify([...published, `${pkg.name}@${pkg.version}`]));
  process.exit(0);
}
process.exit(2);
