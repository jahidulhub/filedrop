import { config } from './config.js';

const MAX_CLIENTS = 2;
const rooms = new Map();

function removeRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearTimeout(room.timer);
  rooms.delete(roomId);
}

function expireRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const sockets = [...room.sockets];
  removeRoom(roomId);

  for (const socket of sockets) {
    socket.send(JSON.stringify({ type: 'room-expired' }));
    socket.close();
  }
}

export function createRoom(roomId, socket) {
  if (rooms.has(roomId)) {
    return { ok: false, error: 'room_exists' };
  }

  const timer = setTimeout(() => expireRoom(roomId), config.sessionMaxMs);
  rooms.set(roomId, { sockets: new Set([socket]), timer });
  return { ok: true, count: 1 };
}

export function joinRoom(roomId, socket) {
  const room = rooms.get(roomId);

  if (!room) {
    return { ok: false, error: 'room_not_found' };
  }

  if (room.sockets.size >= MAX_CLIENTS) {
    return { ok: false, error: 'room_full' };
  }

  room.sockets.add(socket);
  return { ok: true, count: room.sockets.size };
}

export function leaveRoom(roomId, socket) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.sockets.delete(socket);

  if (room.sockets.size === 0) {
    removeRoom(roomId);
  }
}

export function getPeers(roomId, socket) {
  const room = rooms.get(roomId);
  if (!room) return [];

  return [...room.sockets].filter((s) => s !== socket);
}