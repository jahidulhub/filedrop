const rooms = new Map();

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function createRoom(roomId, expiresAt) {
  const room = {
    expiresAt,
    host: null,
    guest: null,
    guestDevice: null,
  };

  rooms.set(roomId, room);
  return room;
}

export function deleteRoom(roomId) {
  rooms.delete(roomId);
}

export function getRooms() {
  return rooms;
}

export function getRoomCount() {
  return rooms.size;
}