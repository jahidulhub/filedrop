import { WebSocketServer } from 'ws';

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket) => {
    console.log('Client connected');
    socket.send(JSON.stringify({ type: 'welcome' }));

    socket.on('message', (data) => {
      console.log('Received:', data.toString());
      socket.send(JSON.stringify({ type: 'echo', data: data.toString() }));
    });

    socket.on('close', () => {
      console.log('Client disconnected');
    });
  });

  return wss;
}