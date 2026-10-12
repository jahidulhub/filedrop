import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { getRoomCount } from './rooms.js';
import { setupWebSocket } from './websocket.js';
import { startSessionManager } from './session.js';

const app = express();

app.get('/health', (req, res) => {
  res.json({ ok: true, rooms: getRoomCount() });
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  maxPayload: config.maxPayloadBytes,
});

setupWebSocket(wss);
const stopSessionManager = startSessionManager(wss);

server.listen(config.port, '0.0.0.0', () => {
  console.log('=================================');
  console.log(' filedrop server');
  console.log('=================================');
  console.log(`Port: ${config.port}`);
  console.log('Health: /health');
  console.log(`WebSocket: ws://localhost:${config.port}`);
  console.log('=================================');
});

// Railway sends SIGTERM when it redeploys. Close connections cleanly.
function shutdown() {
  console.log('Shutting down...');
  stopSessionManager();

  for (const ws of wss.clients) {
    ws.close(1001, 'Server restarting');
  }

  server.close(() => process.exit(0));

  // Don't wait forever.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);