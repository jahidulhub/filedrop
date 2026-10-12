import { config } from './config.js';
import { getRooms, deleteRoom } from './rooms.js';
import { send, detach } from './signaling.js';

export function startSessionManager(wss) {
  const heartbeat = setInterval(() => pingClients(wss), config.heartbeatMs);
  const sweep = setInterval(expireRooms, config.sweepMs);

  // Returns a function that stops both timers (for a clean shutdown).
  return () => {
    clearInterval(heartbeat);
    clearInterval(sweep);
  };
}

// Every client must answer a ping before the next round.
// If it didn't, the connection is dead, so drop it.
function pingClients(wss) {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }

    ws.isAlive = false;
    ws.ping();
  }
}

function expireRooms() {
  const now = Date.now();

  for (const [roomId, room] of getRooms()) {
    if (room.expiresAt > now) continue;

    for (const ws of [room.host, room.guest]) {
      if (!ws) continue;
      send(ws, { type: 'expired' });
      detach(ws);
    }

    deleteRoom(roomId);
    console.log(`[ROOM ${roomId.slice(0, 8)}] Session expired`);
  }
}