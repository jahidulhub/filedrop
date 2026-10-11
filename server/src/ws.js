import { WebSocketServer } from 'ws';
import { createRoom, joinRoom, leaveRoom, getPeers } from './rooms.js';

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket) => {
    console.log('Client connected');
    let currentRoom = null;

    socket.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return send(socket, { type: 'error', error: 'invalid_json' });
      }

      if (msg.type === 'create' || msg.type === 'join') {
        if (currentRoom) {
          return send(socket, { type: 'error', error: 'already_in_room' });
        }
        if (!msg.roomId || typeof msg.roomId !== 'string') {
          return send(socket, { type: 'error', error: 'room_id_required' });
        }

        const result =
          msg.type === 'create'
            ? createRoom(msg.roomId, socket)
            : joinRoom(msg.roomId, socket);

        if (!result.ok) {
          return send(socket, { type: 'error', error: result.error });
        }

        currentRoom = msg.roomId;
        send(socket, {
          type: msg.type === 'create' ? 'created' : 'joined',
          roomId: currentRoom,
        });

        if (msg.type === 'join') {
          for (const peer of getPeers(currentRoom, socket)) {
            send(peer, { type: 'peer-joined' });
          }
        }
        return;
      }

      send(socket, { type: 'error', error: 'unknown_type' });
    });

    socket.on('close', () => {
      console.log('Client disconnected');
      if (currentRoom) {
        for (const peer of getPeers(currentRoom, socket)) {
          send(peer, { type: 'peer-left' });
        }
        leaveRoom(currentRoom, socket);
      }
    });
  });

  return wss;
}