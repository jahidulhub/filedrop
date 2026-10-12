import { config } from '../config.js';
import { getRoom } from '../rooms.js';
import { send, sendError, detach } from '../signaling.js';

export function handleJoin(ws, message) {
  if (ws.role) {
    return sendError(ws, 'already-joined', 'This connection already has a room');
  }

  const roomId = message.room;
  const device = message.device;

  if (
    typeof roomId !== 'string' ||
    !config.idPattern.test(roomId) ||
    typeof device !== 'string' ||
    !config.idPattern.test(device)
  ) {
    sendError(ws, 'bad-room', 'Invalid connection link');
    return detach(ws);
  }

  const room = getRoom(roomId);

  if (!room) {
    sendError(ws, 'not-found', 'Session not found');
    return detach(ws);
  }

  if (room.expiresAt <= Date.now()) {
    sendError(ws, 'expired', 'Session expired');
    return detach(ws);
  }

  if (room.guest) {
    // A different phone is already in the room.
    if (room.guestDevice !== device) {
      sendError(ws, 'busy', 'Another phone is already connected');
      return detach(ws);
    }

    // The same phone came back. The newest connection wins.
    sendError(room.guest, 'replaced', 'Opened in another tab');
    detach(room.guest, true);

    // Tell the host the old connection is gone, so it can reset
    // its WebRTC connection before the new one arrives.
    send(room.host, { type: 'peer-left' });
  }

  room.guest = ws;
  room.guestDevice = device;
  ws.role = 'guest';
  ws.roomId = roomId;
  clearTimeout(ws.joinTimer);

  console.log(`[ROOM ${roomId.slice(0, 8)}] Phone connected`);

  send(ws, {
    type: 'joined',
    room: roomId,
    expiresAt: room.expiresAt,
    host: Boolean(room.host),
  });

  if (room.host) {
    send(room.host, { type: 'peer-joined' });
  }
}