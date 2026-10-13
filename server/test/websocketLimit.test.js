
import WebSocket from 'ws';
import assert from 'node:assert/strict';

const URL = 'ws://localhost:3000';
const ORIGIN = 'http://localhost:5500';

function connect() {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL, {
      origin: ORIGIN
    });

    ws.once('open', () => {
      resolve({
        ws,
        accepted: true
      });
    });

    ws.once('unexpected-response', (_, response) => {
      const status = response.statusCode;
      response.resume();

      resolve({
        ws,
        accepted: false,
        status
      });
    });

    ws.once('error', (error) => {
      resolve({
        ws,
        accepted: false,
        error: error.message
      });
    });
  });
}

const sockets = [];

try {
  // Open five connections from localhost.
  for (let i = 0; i < 5; i++) {
    const result = await connect();

    assert.equal(
      result.accepted,
      true,
      `Connection ${i + 1} should be accepted`
    );

    sockets.push(result.ws);
  }

  console.log('1. Five connections accepted');

  // The sixth connection must be rejected.
  const sixth = await connect();

  assert.equal(sixth.accepted, false);
  assert.equal(sixth.status, 429);

  console.log('2. Sixth connection rejected with HTTP 429');

  // Close one connection and wait for server cleanup.
  const first = sockets.shift();

  await new Promise((resolve) => {
    first.once('close', resolve);
    first.close();
  });

  const replacement = await connect();

  assert.equal(replacement.accepted, true);
  sockets.push(replacement.ws);

  console.log('3. Connection slot released after disconnect');
  console.log('All WebSocket connection-limit tests passed.');

} catch (error) {
  console.error('TEST FAILED:', error.message);
  process.exitCode = 1;

} finally {
  for (const ws of sockets) {
    ws.terminate();
  }
}