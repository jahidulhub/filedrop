
import { config } from './config.js';
import { getRoom } from './rooms.js';
import { send, sendError, relay } from './signaling.js';
import { handleHost, handleCloseRoom } from './handlers/host.js';
import { handleJoin } from './handlers/guest.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { isValidSignalingMessage } from './middleware/signalingValidation.js';

export function setupWebSocket(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.role = null;
    ws.roomId = null;
    ws.detached = false;

    // Independent rate limiter for each connection.
    ws.allowMessage = createRateLimiter({
      limit: 60,
      windowMs: 10_000
    });

    // A new connection must identify itself quickly.
    ws.joinTimer = setTimeout(() => {
      if (!ws.role) {
        ws.terminate();
      }
    }, config.joinTimeoutMs);

    // WebSocket heartbeat response.
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Validate message rate before processing.
    ws.on('message', (raw) => {
      if (!ws.allowMessage()) {
        sendError(
          ws,
          'rate-limited',
          'Too many signaling messages'
        );

        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      onMessage(ws, raw);
    });

    ws.on('close', () => {
      onClose(ws);
    });

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
    return sendError(
      ws,
      'invalid-message',
      'Invalid message'
    );
  }

  // Validate the basic message structure.
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message) ||
    typeof message.type !== 'string'
  ) {
    return sendError(
      ws,
      'invalid-message',
      'Invalid message'
    );
  }

  try {
    route(ws, message);
  } catch (error) {
    console.error('[HANDLER ERROR]', error);

    sendError(
      ws,
      'server-error',
      'Something went wrong'
    );
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
      return sendError(
        ws,
        'unknown-type',
        'Unknown message type'
      );
  }
}


function handleRelay(ws, message) {
  // Validate signaling payload before forwarding.
  if (!isValidSignalingMessage(message)) {
    return sendError(
      ws,
      'invalid-signal',
      'Invalid WebRTC signaling message'
    );
  }

  const room = ws.role
    ? getRoom(ws.roomId)
    : null;

  if (!room) {
    return sendError(
      ws,
      'not-in-room',
      'Join a room first'
    );
  }

  // Reject stale or replaced connections.
  const isCurrentHost =
    ws.role === 'host' &&
    room.host === ws;

  const isCurrentGuest =
    ws.role === 'guest' &&
    room.guest === ws;

  if (!isCurrentHost && !isCurrentGuest) {
    return sendError(
      ws,
      'unauthorized',
      'Connection is no longer authorized'
    );
  }

  if (!relay(ws, message, room)) {
    return sendError(
      ws,
      'peer-offline',
      'The other device is not connected'
    );
  }
}


function onClose(ws) {
  clearTimeout(ws.joinTimer);

  // Ignore intentionally detached connections
  // or connections that never joined a room.
  if (ws.detached || !ws.role) {
    return;
  }

  const room = getRoom(ws.roomId);

  if (!room) {
    return;
  }

  const shortId = ws.roomId.slice(0, 8);

  if (
    ws.role === 'host' &&
    room.host === ws
  ) {
    room.host = null;

    console.log(
      `[ROOM ${shortId}] Host disconnected`
    );

    send(room.guest, {
      type: 'host-left'
    });
  }

  if (
    ws.role === 'guest' &&
    room.guest === ws
  ) {
    room.guest = null;
    room.guestDevice = null;

    console.log(
      `[ROOM ${shortId}] Phone disconnected`
    );

    send(room.host, {
      type: 'peer-left'
    });
  }
}
