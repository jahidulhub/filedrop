const MAX_CLIENTS = 2;
const rooms = new Map();

export function createRoom(roomId, socket) {
  if (rooms.has(roomId)) {
    return { ok: false, error: 'room_exists' };
  }

  rooms.set(roomId, new Set([socket]));
  return { ok: true, count: 1 };
}

export function joinRoom(roomId, socket) {
  const room = rooms.get(roomId);

  if (!room) {
    return { ok: false, error: 'room_not_found' };
  }

  if (room.size >= MAX_CLIENTS) {
    return { ok: false, error: 'room_full' };
  }

  room.add(socket);
  return { ok: true, count: room.size };
}

export function leaveRoom(roomId, socket) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(socket);

  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

export function getPeers(roomId, socket) {
  const room = rooms.get(roomId);
  if (!room) return [];

  return [...room].filter((s) => s !== socket);
}