import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestRequestGuard } from '../apps/zland/src/audio/requestGuard.ts';

test('a second source invalidates a late result from the first source', () => {
  const requests = createLatestRequestGuard();
  const first = requests.begin();
  const second = requests.begin();
  assert.equal(requests.isCurrent(first), false);
  assert.equal(requests.isCurrent(second), true);
  requests.invalidate();
  assert.equal(requests.isCurrent(second), false);
});

