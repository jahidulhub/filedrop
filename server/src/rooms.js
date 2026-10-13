
import {
  timingSafeEqual
} from 'node:crypto';

const rooms = new Map();

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function tokensMatch(a, b) {
  if (
    typeof a !== 'string' ||
    typeof b !== 'string'
  ) {
    return false;
  }

  if (
    !TOKEN_PATTERN.test(a) ||
    !TOKEN_PATTERN.test(b)
  ) {
    return false;
  }

  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');

  return timingSafeEqual(left, right);
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function createRoom(
  roomId,
  expiresAt,
  hostToken
) {
  if (
    typeof hostToken !== 'string' ||
    !TOKEN_PATTERN.test(hostToken)
  ) {
    throw new Error('Invalid host token');
  }

  if (rooms.has(roomId)) {
    throw new Error('Room already exists');
  }

  const room = {
    expiresAt,
    hostToken,
    host: null,
    guest: null,
    guestDevice: null,
    guestToken: null
  };

  rooms.set(roomId, room);

  return room;
}

export function verifyHostToken(room, token) {
  if (!room) {
    return false;
  }

  return tokensMatch(
    room.hostToken,
    token
  );
}

export function verifyGuestToken(room, token) {
  if (!room || !room.guestToken) {
    return false;
  }

  return tokensMatch(
    room.guestToken,
    token
  );
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
