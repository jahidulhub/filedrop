
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createConnectionLimiter
} from '../src/middleware/connectionLimit.js';

test('allows connections below limit', () => {
  const limiter = createConnectionLimiter({
    maxPerIp: 2,
    maxTotal: 10
  });

  assert.equal(limiter.reserve('127.0.0.1'), true);
  assert.equal(limiter.reserve('127.0.0.1'), true);
  assert.equal(limiter.getCount('127.0.0.1'), 2);
});

test('rejects connections at per-IP limit', () => {
  const limiter = createConnectionLimiter({
    maxPerIp: 2,
    maxTotal: 10
  });

  assert.equal(limiter.reserve('127.0.0.1'), true);
  assert.equal(limiter.reserve('127.0.0.1'), true);
  assert.equal(limiter.reserve('127.0.0.1'), false);
});

test('tracks IP addresses independently', () => {
  const limiter = createConnectionLimiter({
    maxPerIp: 1,
    maxTotal: 10
  });

  assert.equal(limiter.reserve('192.168.1.10'), true);
  assert.equal(limiter.reserve('192.168.1.11'), true);
  assert.equal(limiter.reserve('192.168.1.10'), false);
});

test('enforces the global connection limit', () => {
  const limiter = createConnectionLimiter({
    maxPerIp: 5,
    maxTotal: 2
  });

  assert.equal(limiter.reserve('192.168.1.10'), true);
  assert.equal(limiter.reserve('192.168.1.11'), true);
  assert.equal(limiter.reserve('192.168.1.12'), false);
  assert.equal(limiter.getTotal(), 2);
});

test('releases connection slots', () => {
  const limiter = createConnectionLimiter({
    maxPerIp: 1,
    maxTotal: 1
  });

  assert.equal(limiter.reserve('127.0.0.1'), true);
  assert.equal(limiter.reserve('127.0.0.1'), false);

  limiter.release('127.0.0.1');

  assert.equal(limiter.getTotal(), 0);
  assert.equal(limiter.reserve('127.0.0.1'), true);
});

test('does not allow negative connection counts', () => {
  const limiter = createConnectionLimiter();

  limiter.release('127.0.0.1');

  assert.equal(limiter.getTotal(), 0);
  assert.equal(limiter.getCount('127.0.0.1'), 0);
});

test('rejects invalid IP identifiers', () => {
  const limiter = createConnectionLimiter();

  assert.equal(limiter.reserve(''), false);
  assert.equal(limiter.reserve(null), false);
  assert.equal(limiter.getTotal(), 0);
});
