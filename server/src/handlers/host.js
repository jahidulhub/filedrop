
import { config } from '../config.js';

import {
  getRoom,
  createRoom,
  deleteRoom,
  verifyHostToken
} from '../rooms.js';

import {
  send,
  sendError,
  detach
} from '../signaling.js';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function handleHost(ws, message) {
  if (ws.role) {
    return sendError(
      ws,
      'already-joined',
      'This connection already has a room'
    );
  }

  const roomId = message.room;
  const hostToken = message.hostToken;

  if (
    typeof roomId !== 'string' ||
    !config.idPattern.test(roomId) ||
    typeof hostToken !== 'string' ||
    !TOKEN_PATTERN.test(hostToken)
  ) {
    return sendError(
      ws,
      'invalid-credentials',
      'Invalid room credentials'
    );
  }

  const now = Date.now();
  let expiresAt = Number(message.expiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return sendError(ws, 'expired', 'Session expired');
  }

  if (expiresAt > now + config.sessionMs + config.clockSlackMs) {
    expiresAt = now + config.sessionMs;
  }

  let room = getRoom(roomId);
  let isReconnect = false;

  if (room) {
    if (room.expiresAt <= now) {
      return sendError(ws, 'expired', 'Session expired');
    }

    // Only the original host can reclaim this room.
    if (!verifyHostToken(room, hostToken)) {
      return sendError(
        ws,
        'unauthorized',
        'Not authorized to host this room'
      );
    }

    isReconnect = room.host === null;

    // An authorized host can replace its previous connection.
    if (room.host && room.host !== ws) {
      sendError(
        room.host,
        'replaced',
        'Opened in another window'
      );

      detach(room.host, true);
    }
  } else {
    room = createRoom(roomId, expiresAt, hostToken);
  }

  room.host = ws;
  ws.role = 'host';
  ws.roomId = roomId;

  clearTimeout(ws.joinTimer);

  console.log(
    `[ROOM ${roomId.slice(0, 8)}] Host ${
      isReconnect ? 'reconnected' : 'connected'
    }`
  );

  send(ws, {
    type: 'hosted',
    room: roomId,
    expiresAt: room.expiresAt,
    phone: Boolean(room.guest)
  });

  if (room.guest) {
    send(room.guest, { type: 'host-joined' });
    send(ws, { type: 'peer-joined' });
  }
}

export function handleCloseRoom(ws) {
  if (ws.role !== 'host') {
    return sendError(
      ws,
      'not-host',
      'Only the host can close the room'
    );
  }

  const roomId = ws.roomId;
  const room = getRoom(roomId);

  // Reject stale host connections.
  if (!room || room.host !== ws) {
    return sendError(
      ws,
      'unauthorized',
      'Not authorized to close this room'
    );
  }

  if (room.guest) {
    send(room.guest, { type: 'revoked' });
    detach(room.guest);
  }

  deleteRoom(roomId);

  console.log(
    `[ROOM ${roomId.slice(0, 8)}] Closed by host`
  );

  ws.role = null;
  ws.roomId = null;

  send(ws, { type: 'room-closed' });
}
