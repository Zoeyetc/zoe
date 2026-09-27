import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveConfig } from 'vite';

test('development serves the installed Engine directly so a stale optimized 0.2 bundle cannot mask onDiagnostic', async () => {
  const config = await resolveConfig({}, 'serve');
  assert.ok(config.optimizeDeps.exclude?.includes('@zoeyetc/computational-listening-engine'));
  const manifest = JSON.parse(readFileSync('node_modules/@zoeyetc/computational-listening-engine/package.json', 'utf8'));
  assert.equal(manifest.version, '0.3.1');
  const rolling = readFileSync('node_modules/@zoeyetc/computational-listening-engine/dist/streaming/RollingListeningSession.js', 'utf8');
  assert.match(rolling, /options\.onDiagnostic\(record\)/);
  assert.match(rolling, /built-in-production/);
});
