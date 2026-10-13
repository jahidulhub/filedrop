
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';

const HOST = '127.0.0.1';
const PORT = 3000;
const URL = `ws://${HOST}:${PORT}`;
const ORIGIN = 'http://localhost:5500';

const delay = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL, {
      origin: ORIGIN
    });

    ws.once('open', () => resolve(ws));
    ws.once('error', reject);

    ws.once('unexpected-response', (_, response) => {
      response.resume();
      reject(
        new Error(`HTTP ${response.statusCode}`)
      );
    });
  });
}

function interruptedUpgrade() {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, HOST);

    socket.once('error', reject);

    socket.once('connect', () => {
      const key = randomBytes(16).toString('base64');

      socket.write(
        'GET / HTTP/1.1\r\n' +
        `Host: ${HOST}:${PORT}\r\n` +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${key}\r\n` +
        'Sec-WebSocket-Version: 13\r\n' +
        `Origin: ${ORIGIN}\r\n` +
        '\r\n'
      );

      // Abort the TCP connection immediately.
      socket.destroy();
      resolve();
    });
  });
}

const sockets = [];

try {
  // Test 1: Interrupted handshakes.
  for (let i = 0; i < 10; i++) {
    await interruptedUpgrade();
  }

  await delay(300);

  console.log('1. Ten interrupted handshakes sent');

  // Test 2: Five normal connections.
  for (let i = 0; i < 5; i++) {
    sockets.push(await connect());
  }

  console.log('2. Five normal connections accepted');

  // Test 3: Verify slot cleanup after disconnect.
  const first = sockets.shift();

  await new Promise(resolve => {
    first.once('close', resolve);
    first.close();
  });

  await delay(100);

  sockets.push(await connect());

  console.log('3. Disconnected slot reused');
  console.log('All upgrade cleanup tests passed.');

} catch (error) {
  console.error('TEST FAILED:', error.message);
  process.exitCode = 1;

} finally {
  for (const ws of sockets) {
    ws.terminate();
  }
}
