import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const files = scripts.test.replace(/^tsx --test /, '').split(' ');
mkdirSync('coverage', { recursive: true });

const result = spawnSync(process.execPath, [
  '--import=tsx', '--test', '--experimental-test-coverage',
  '--test-reporter=spec', '--test-reporter=lcov',
  '--test-reporter-destination=stdout',
  '--test-reporter-destination=coverage/lcov.info',
  ...files,
], { stdio: 'inherit' });

process.exit(result.status ?? 1);
