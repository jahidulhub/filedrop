
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const URL = 'ws://127.0.0.1:3000';
const ORIGIN = 'http://localhost:5500';

const delay = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL, {
      origin: ORIGIN
    });

    ws.once('open', () => {
      resolve(ws);
    });

    ws.once('error', reject);

    ws.once('unexpected-response', (_, response) => {
      response.resume();

      reject(
        new Error(`HTTP ${response.statusCode}`)
      );
    });
  });
}

function disconnect(ws) {
  return new Promise(resolve => {
    ws.once('close', resolve);
    ws.terminate();
  });
}

const sockets = [];

try {
  console.log('Testing WebSocket disconnect cleanup...');

  // Test 1: Repeated connections and disconnections.
  for (let i = 0; i < 20; i++) {
    const ws = await connect();

    await disconnect(ws);

    // Allow the server to process the disconnect.
    await delay(100);
  }

  console.log('1. Twenty connect/disconnect cycles passed');

  // Test 2: Open five simultaneous connections.
  for (let i = 0; i < 5; i++) {
    const ws = await connect();

    sockets.push(ws);
  }

  assert.equal(sockets.length, 5);

  console.log('2. Five simultaneous connections accepted');

  // Test 3: Sixth connection must be rejected.
  let rejected = false;

  try {
    const sixth = await connect();
    sockets.push(sixth);
  } catch (error) {
    if (error.message === 'HTTP 429') {
      rejected = true;
    } else {
      throw error;
    }
  }

  assert.equal(rejected, true);

  console.log('3. Sixth connection rejected with HTTP 429');

  console.log('All disconnect cleanup tests passed.');

} catch (error) {
  console.error('TEST FAILED:', error.message);
  process.exitCode = 1;

} finally {
  for (const ws of sockets) {
    ws.terminate();
  }
}
