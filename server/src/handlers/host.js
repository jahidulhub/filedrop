import { config } from '../config.js';
import { getRoom, createRoom, deleteRoom } from '../rooms.js';
import { send, sendError, detach } from '../signaling.js';

export function handleHost(ws, message) {
  if (ws.role) {
    return sendError(ws, 'already-joined', 'This connection already has a room');
  }

  const roomId = message.room;

  if (typeof roomId !== 'string' || !config.idPattern.test(roomId)) {
    return sendError(ws, 'bad-room', 'Invalid room ID');
  }

  const now = Date.now();
  let expiresAt = Number(message.expiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return sendError(ws, 'expired', 'Session expired');
  }

  // Never allow a session longer than the server limit.
  if (expiresAt > now + config.sessionMs + config.clockSlackMs) {
    expiresAt = now + config.sessionMs;
  }

  let room = getRoom(roomId);
  let isReconnect = false;

  if (room) {
    // The room exists but has already run out of time.
    if (room.expiresAt <= now) {
      return sendError(ws, 'expired', 'Session expired');
    }

    // No host right now means the extension is coming back.
    isReconnect = room.host === null;

    // Another window is hosting this room. The newest connection wins.
    if (room.host && room.host !== ws) {
      sendError(room.host, 'replaced', 'Opened in another window');
      detach(room.host, true);
    }
  } else {
    room = createRoom(roomId, expiresAt);
  }

  room.host = ws;
  ws.role = 'host';
  ws.roomId = roomId;
  clearTimeout(ws.joinTimer);

  console.log(
    `[ROOM ${roomId.slice(0, 8)}] Host ${isReconnect ? 'reconnected' : 'connected'}`
  );

  send(ws, {
    type: 'hosted',
    room: roomId,
    expiresAt: room.expiresAt,
    phone: Boolean(room.guest),
  });

  // A phone was already waiting in the room.
  if (room.guest) {
    send(room.guest, { type: 'host-joined' });
    send(ws, { type: 'peer-joined' });
  }
}

export function handleCloseRoom(ws) {
  if (ws.role !== 'host') {
    return sendError(ws, 'not-host', 'Only the host can close the room');
  }

  const roomId = ws.roomId;
  const room = getRoom(roomId);

  if (room) {
    if (room.guest) {
      send(room.guest, { type: 'revoked' });
      detach(room.guest);
    }
    deleteRoom(roomId);
  }

  console.log(`[ROOM ${roomId.slice(0, 8)}] Closed by host`);

  ws.role = null;
  ws.roomId = null;
  send(ws, { type: 'room-closed' });
}