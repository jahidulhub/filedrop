
import WebSocket from 'ws';
import { randomUUID, randomBytes } from 'node:crypto';

const URL = 'ws://localhost:3000';
const ORIGIN = 'http://localhost:5500';

const room = randomUUID();
const hostToken = randomBytes(32).toString('hex');
const wrongToken = randomBytes(32).toString('hex');
const expiresAt = Date.now() + 60_000;

function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL, {
      origin: ORIGIN
    });

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('Connection timed out'));
    }, 5000);

    ws.once('open', () => {
      ws.send(JSON.stringify({
        type: 'host',
        room,
        hostToken: token,
        expiresAt
      }));
    });

    ws.once('message', data => {
      clearTimeout(timeout);

      const message = JSON.parse(data.toString());
      resolve({ ws, message });
    });

    ws.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

let firstHost;
let attacker;
let reconnectedHost;

try {
  firstHost = await connect(hostToken);

  console.log(
    '1. Create room:',
    firstHost.message.type
  );

  if (firstHost.message.type !== 'hosted') {
    throw new Error('Room creation failed');
  }

  attacker = await connect(wrongToken);

  console.log(
    '2. Wrong token:',
    attacker.message.code
  );

  if (attacker.message.code !== 'unauthorized') {
    throw new Error('Unauthorized takeover was not rejected');
  }

  reconnectedHost = await connect(hostToken);

  console.log(
    '3. Correct token reconnect:',
    reconnectedHost.message.type
  );

  if (reconnectedHost.message.type !== 'hosted') {
    throw new Error('Authorized reconnect failed');
  }

  console.log('All host authorization tests passed.');
} catch (error) {
  console.error('TEST FAILED:', error.message);
  process.exitCode = 1;
} finally {
  firstHost?.ws.terminate();
  attacker?.ws.terminate();
  reconnectedHost?.ws.terminate();
}
