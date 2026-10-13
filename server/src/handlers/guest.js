
import { randomBytes } from 'node:crypto';

import { config } from '../config.js';

import {
  getRoom,
  verifyGuestToken
} from '../rooms.js';

import {
  send,
  sendError,
  detach
} from '../signaling.js';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function handleJoin(ws, message) {
  if (ws.role) {
    return sendError(
      ws,
      'already-joined',
      'This connection already has a room'
    );
  }

  const roomId = message.room;
  const device = message.device;
  const guestToken = message.guestToken;

  if (
    typeof roomId !== 'string' ||
    !config.idPattern.test(roomId) ||
    typeof device !== 'string' ||
    !config.idPattern.test(device)
  ) {
    sendError(
      ws,
      'bad-room',
      'Invalid connection link'
    );

    return detach(ws);
  }

  const room = getRoom(roomId);

  if (!room) {
    sendError(
      ws,
      'not-found',
      'Session not found'
    );

    return detach(ws);
  }

  if (room.expiresAt <= Date.now()) {
    sendError(
      ws,
      'expired',
      'Session expired'
    );

    return detach(ws);
  }

  // First phone joining this room.
  if (!room.guestToken) {
    // Do not let another phone claim an existing
    // connection without an established token.
    if (room.guest) {
      sendError(
        ws,
        'busy',
        'Another phone is already connected'
      );

      return detach(ws);
    }

    room.guestToken = randomBytes(32).toString('hex');
    room.guestDevice = device;
  } else {
    // Returning phones must prove ownership.
    if (
      typeof guestToken !== 'string' ||
      !TOKEN_PATTERN.test(guestToken) ||
      !verifyGuestToken(room, guestToken) ||
      room.guestDevice !== device
    ) {
      sendError(
        ws,
        'unauthorized',
        'Not authorized to reconnect'
      );

      return detach(ws);
    }

    // The authorized phone can replace its
    // previous WebSocket connection.
    if (room.guest && room.guest !== ws) {
      sendError(
        room.guest,
        'replaced',
        'Opened in another tab'
      );

      detach(room.guest, true);

      // Allow the host to reset WebRTC state.
      send(room.host, {
        type: 'peer-left'
      });
    }
  }

  room.guest = ws;
  room.guestDevice = device;

  ws.role = 'guest';
  ws.roomId = roomId;

  clearTimeout(ws.joinTimer);

  console.log(
    `[ROOM ${roomId.slice(0, 8)}] Phone connected`
  );

  send(ws, {
    type: 'joined',
    room: roomId,
    expiresAt: room.expiresAt,
    host: Boolean(room.host),

    // Send the secret only to the authorized phone.
    guestToken: room.guestToken
  });

  if (room.host) {
    send(room.host, {
      type: 'peer-joined'
    });
  }
}
