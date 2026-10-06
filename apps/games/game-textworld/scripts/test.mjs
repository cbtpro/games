import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'textworld-tests-'));
try {
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
  const compile = spawnSync(
    process.execPath,
    [
      require.resolve('typescript/lib/tsc.js'),
      '-p',
      join(root, 'tests/tsconfig.json'),
      '--outDir',
      output,
    ],
    { stdio: 'inherit' },
  );
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const tests = readdirSync(join(output, 'tests'))
      .filter((name) => name.endsWith('.test.js'))
      .map((name) => join(output, 'tests', name));
    const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
    process.exitCode = result.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
