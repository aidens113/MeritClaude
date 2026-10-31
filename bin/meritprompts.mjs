#!/usr/bin/env node
// meritprompts <install|branch|usage> [...args]: entry point for the npm package.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS = {
  install: ['install.mjs', 'install Claude rules/agents/hooks, or --codex for Codex rules (dry run unless --apply)'],
  branch: ['tools/branch.mjs', 'automatic branch management: status, init, start, sync, finish, promote, publish'],
  usage: ['tools/usage-report.mjs', 'subagent token use by model'],
};

const [command, ...rest] = process.argv.slice(2);
if (!COMMANDS[command]) {
  console.log('usage: meritprompts <command> [...args]\n');
  for (const [name, [, about]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(8)} ${about}`);
  process.exit(command ? 1 : 0);
}
const r = spawnSync(process.execPath, [join(ROOT, COMMANDS[command][0]), ...rest], { stdio: 'inherit' });
process.exit(r.status ?? 1);
