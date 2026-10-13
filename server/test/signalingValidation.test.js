
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidSignalingMessage
} from '../src/middleware/signalingValidation.js';

const validSdp = 'v=0\r\n';

test('accepts valid WebRTC offer', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'offer',
      offer: {
        type: 'offer',
        sdp: validSdp
      }
    }),
    true
  );
});

test('accepts valid WebRTC answer', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'answer',
      answer: {
        type: 'answer',
        sdp: validSdp
      }
    }),
    true
  );
});

test('rejects offer with incorrect SDP type', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'offer',
      offer: {
        type: 'answer',
        sdp: validSdp
      }
    }),
    false
  );
});

test('rejects missing SDP', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'offer',
      offer: {
        type: 'offer'
      }
    }),
    false
  );
});

test('rejects oversized SDP', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'offer',
      offer: {
        type: 'offer',
        sdp: 'x'.repeat(60_001)
      }
    }),
    false
  );
});

test('accepts valid ICE candidate', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'ice-candidate',
      candidate: {
        candidate: 'candidate:1 1 UDP 123 127.0.0.1 5000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0
      }
    }),
    true
  );
});

test('accepts null ICE candidate', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'ice-candidate',
      candidate: null
    }),
    true
  );
});

test('rejects invalid ICE candidate', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'ice-candidate',
      candidate: {
        candidate: 12345
      }
    }),
    false
  );
});

test('rejects negative media line index', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'ice-candidate',
      candidate: {
        candidate: 'candidate:1',
        sdpMLineIndex: -1
      }
    }),
    false
  );
});

test('rejects unknown signaling type', () => {
  assert.equal(
    isValidSignalingMessage({
      type: 'unknown',
      payload: {}
    }),
    false
  );
});

test('rejects null and array messages', () => {
  assert.equal(isValidSignalingMessage(null), false);
  assert.equal(isValidSignalingMessage([]), false);
});
