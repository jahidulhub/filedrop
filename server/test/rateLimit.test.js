
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRateLimiter
} from '../src/middleware/rateLimit.js';

test('allows messages within the limit', () => {
  const allow = createRateLimiter({
    limit: 3,
    windowMs: 1000
  });

  assert.equal(allow(), true);
  assert.equal(allow(), true);
  assert.equal(allow(), true);
});

test('rejects messages exceeding the limit', () => {
  const allow = createRateLimiter({
    limit: 2,
    windowMs: 1000
  });

  assert.equal(allow(), true);
  assert.equal(allow(), true);
  assert.equal(allow(), false);
});

test('each connection has an independent limiter', () => {
  const first = createRateLimiter({
    limit: 1,
    windowMs: 1000
  });

  const second = createRateLimiter({
    limit: 1,
    windowMs: 1000
  });

  assert.equal(first(), true);
  assert.equal(first(), false);

  assert.equal(second(), true);
});
