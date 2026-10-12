import { config } from './config.js';
import { getRoom } from './rooms.js';
import { send, sendError, relay } from './signaling.js';
import { handleHost, handleCloseRoom } from './handlers/host.js';
import { handleJoin } from './handlers/guest.js';

export function setupWebSocket(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.role = null;
    ws.roomId = null;
    ws.detached = false;

    // A new connection must identify itself (host or join) quickly.
    ws.joinTimer = setTimeout(() => {
      if (!ws.role) ws.terminate();
    }, config.joinTimeoutMs);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => onMessage(ws, raw));
    ws.on('close', () => onClose(ws));
    ws.on('error', (error) => {
      console.error('[SOCKET ERROR]', error.message);
    });
  });
}

function onMessage(ws, raw) {
  let message;

  try {
    message = JSON.parse(raw.toString());
  } catch {
    return sendError(ws, 'invalid-message', 'Invalid message');
  }

  // Valid JSON is not enough. It must be an object with a type.
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return sendError(ws, 'invalid-message', 'Invalid message');
  }

  try {
    route(ws, message);
  } catch (error) {
    console.error('[HANDLER ERROR]', error);
    sendError(ws, 'server-error', 'Something went wrong');
  }
}

function route(ws, message) {
  switch (message.type) {
    case 'host':
      return handleHost(ws, message);

    case 'join':
      return handleJoin(ws, message);

    case 'close-room':
      return handleCloseRoom(ws);

    case 'offer':
    case 'answer':
    case 'ice-candidate':
      return handleRelay(ws, message);

    default:
      return sendError(ws, 'unknown-type', 'Unknown message type');
  }
}

function handleRelay(ws, message) {
  const room = ws.role ? getRoom(ws.roomId) : null;

  if (!room) {
    return sendError(ws, 'not-in-room', 'Join a room first');
  }

  if (!relay(ws, message, room)) {
    sendError(ws, 'peer-offline', 'The other device is not connected');
  }
}

function onClose(ws) {
  clearTimeout(ws.joinTimer);

  // Closed on purpose (replaced, revoked, expired), or never joined a room.
  if (ws.detached || !ws.role) return;

  const room = getRoom(ws.roomId);
  if (!room) return;

  const shortId = ws.roomId.slice(0, 8);

  if (ws.role === 'host' && room.host === ws) {
    room.host = null;
    console.log(`[ROOM ${shortId}] Host disconnected`);
    send(room.guest, { type: 'host-left' });
  }

  if (ws.role === 'guest' && room.guest === ws) {
    room.guest = null;
    room.guestDevice = null;
    console.log(`[ROOM ${shortId}] Phone disconnected`);
    send(room.host, { type: 'peer-left' });
  }
}