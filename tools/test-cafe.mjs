import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testBuild = resolve(workspace, '.cafe-test-build');
if (dirname(testBuild) !== workspace) throw new Error('Test output must stay inside the workspace');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const compiled = spawnSync(npmCommand, ['exec', '--', 'tsc', '-p', 'tsconfig.cafe-tests.json'], {
  cwd: workspace,
  encoding: 'utf8',
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (compiled.error) throw compiled.error;
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const tested = spawnSync(process.execPath, ['--test', 'tests/cafe-core.test.mjs', 'tests/cafe-flow.test.mjs'], {
  cwd: workspace,
  encoding: 'utf8',
  stdio: 'inherit',
});
rmSync(testBuild, { recursive: true, force: true });
process.exit(tested.status ?? 1);
