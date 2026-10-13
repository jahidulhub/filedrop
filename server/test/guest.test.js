
import WebSocket from 'ws';
import { randomUUID, randomBytes } from 'node:crypto';

const URL = 'ws://localhost:3000';
const ORIGIN = 'http://localhost:5500';

const room = randomUUID();
const device = randomUUID();
const hostToken = randomBytes(32).toString('hex');
const expiresAt = Date.now() + 60_000;

function connect(message) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL, {
      origin: ORIGIN
    });

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('Connection timed out'));
    }, 5000);

    ws.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.once('message', (raw) => {
      clearTimeout(timeout);

      resolve({
        ws,
        response: JSON.parse(raw.toString())
      });
    });

    ws.once('open', () => {
      ws.send(JSON.stringify(message));
    });
  });
}

function expectType(response, expected) {
  if (response.type !== expected) {
    throw new Error(
      `Expected ${expected}, got ${JSON.stringify(response)}`
    );
  }
}

const sockets = [];

try {
  const host = await connect({
    type: 'host',
    room,
    hostToken,
    expiresAt
  });

  sockets.push(host.ws);
  expectType(host.response, 'hosted');

  const first = await connect({
    type: 'join',
    room,
    device
  });

  sockets.push(first.ws);
  expectType(first.response, 'joined');

  const guestToken = first.response.guestToken;

  if (!/^[a-f0-9]{64}$/i.test(guestToken)) {
    throw new Error('Missing or invalid guest token');
  }

  console.log('1. First guest joins: passed');

  const attacker = await connect({
    type: 'join',
    room,
    device,
    guestToken: randomBytes(32).toString('hex')
  });

  sockets.push(attacker.ws);
  expectType(attacker.response, 'error');

  if (attacker.response.code !== 'unauthorized') {
    throw new Error('Wrong token was not rejected');
  }

  console.log('2. Wrong guest token: rejected');

  const reconnect = await connect({
    type: 'join',
    room,
    device,
    guestToken
  });

  sockets.push(reconnect.ws);
  expectType(reconnect.response, 'joined');

  
console.log('3. Correct guest token: reconnected');

// Test: Different device using the correct guest token.
const differentDevice = await connect({
  type: 'join',
  room,
  device: randomUUID(),
  guestToken
});

sockets.push(differentDevice.ws);

expectType(differentDevice.response, 'error');

if (differentDevice.response.code !== 'unauthorized') {
  throw new Error(
    'Different device was not rejected'
  );
}

console.log('4. Different device: rejected');

console.log('All guest authentication tests passed.');

} catch (error) {
  console.error('TEST FAILED:', error.message);
  process.exitCode = 1;

} finally {
  for (const ws of sockets) {
    ws.terminate();
  }
}