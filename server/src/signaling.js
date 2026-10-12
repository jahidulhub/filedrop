import { WebSocket } from 'ws';

// Which field carries the payload for each relayed message type.
const RELAY_FIELDS = {
  offer: 'offer',
  answer: 'answer',
  'ice-candidate': 'candidate',
};

export function send(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function sendError(ws, code, message) {
  send(ws, { type: 'error', code, message });
}

// Close a socket on purpose. Marking it as detached tells the close
// handler not to treat it as an unexpected disconnect.
export function detach(ws, terminate = false) {
  if (!ws) return;

  ws.detached = true;

  if (terminate) {
    ws.terminate();
  } else {
    ws.close(1000);
  }
}

function getOtherSide(room, ws) {
  return ws.role === 'host' ? room.guest : room.host;
}

// Forward a signaling message to the other side of the room.
// Returns true if it was delivered, false if nobody is there to receive it.
export function relay(ws, message, room) {
  const field = RELAY_FIELDS[message.type];
  if (!ws.role || !field) return false;

  const target = getOtherSide(room, ws);
  if (!target || target.readyState !== WebSocket.OPEN) return false;

  send(target, { type: message.type, [field]: message[field] });
  return true;
}