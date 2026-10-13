
import http from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';

import { config } from './config.js';
import { getRoomCount } from './rooms.js';
import { setupWebSocket } from './websocket.js';
import { startSessionManager } from './session.js';
import { isAllowedOrigin } from './middleware/originPolicy.js';
import { createConnectionLimiter } from './middleware/connectionLimit.js';

const MAX_CONNECTIONS = 100;
const MAX_CONNECTIONS_PER_IP = 5;

const app = express();

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    rooms: getRoomCount()
  });
});

const server = http.createServer(app);

const connectionLimiter = createConnectionLimiter({
  maxPerIp: MAX_CONNECTIONS_PER_IP,
  maxTotal: MAX_CONNECTIONS
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: config.maxPayloadBytes
});

// Register signaling handlers.
setupWebSocket(wss);

// Handle WebSocket upgrades manually.
server.on('upgrade', (req, socket, head) => {
  if (shuttingDown) {
    socket.write(
      'HTTP/1.1 503 Service Unavailable\r\n' +
      'Connection: close\r\n\r\n'
    );
    socket.destroy();
    return;
  }

  // Validate the browser's Origin header.
  if (!isAllowedOrigin(req.headers.origin)) {
    console.warn('[WS] Rejected unauthorized origin');

    socket.write(
      'HTTP/1.1 403 Forbidden\r\n' +
      'Connection: close\r\n\r\n'
    );
    socket.destroy();
    return;
  }

  const ip = req.socket.remoteAddress;

  // Reserve capacity before accepting the upgrade.
  if (!connectionLimiter.reserve(ip)) {
    console.warn('[WS] Connection limit reached');

    socket.write(
      'HTTP/1.1 429 Too Many Requests\r\n' +
      'Connection: close\r\n\r\n'
    );
    socket.destroy();
    return;
  }

  let upgraded = false;

  const releaseReservation = () => {
    if (!upgraded) {
      connectionLimiter.release(ip);
    }
  };

  socket.once('close', releaseReservation);

  try {
    wss.handleUpgrade(req, socket, head, (ws) => {
      upgraded = true;

      socket.removeListener('close', releaseReservation);

      // Release capacity when this WebSocket closes.
      ws.once('close', () => {
        connectionLimiter.release(ip);
      });

      wss.emit('connection', ws, req);
    });
  } catch (error) {
    console.error('[WS UPGRADE ERROR]', error.message);

    if (!socket.destroyed) {
      socket.destroy();
    }
  }
});

const stopSessionManager = startSessionManager(wss);

server.listen(config.port, '0.0.0.0', () => {
  console.log('=================================');
  console.log(' filedrop server');
  console.log('=================================');
  console.log(`Port: ${config.port}`);
  console.log('Health: /health');
  console.log(`WebSocket: ws://localhost:${config.port}`);
  console.log(`Connection limit: ${MAX_CONNECTIONS}`);
  console.log(`Per-IP limit: ${MAX_CONNECTIONS_PER_IP}`);
  console.log('=================================');
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log('Shutting down...');

  stopSessionManager();

  for (const ws of wss.clients) {
    ws.close(1001, 'Server restarting');
  }

  server.close(() => {
    process.exit(0);
  });

  // Avoid waiting indefinitely for open connections.
  setTimeout(() => {
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
