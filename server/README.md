# filedrop server

Signaling server for filedrop. It introduces a phone and a computer to each other so they can connect directly with WebRTC. It never sees your files: it only relays the WebRTC setup messages (`offer`, `answer` and `ice-candidate`).

## Requirements

- Node.js 18 or newer

## Quick start

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Then open `http://localhost:3000/health`. You should see:

```json
{ "ok": true, "rooms": 0 }
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts the server and restarts it when a file in `src/` changes |
| `npm start` | Starts the server (use this in production) |

## Configuration

Settings come from environment variables. Copy `.env.example` to `.env` to set them locally. The server does not reload `.env` while running, so restart it after a change.

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3000` | Port to listen on |
| `SESSION_MAX_MINUTES` | `180` | Longest a room can live, in minutes |

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Returns `{ "ok": true, "rooms": <number> }` |
| WebSocket on the same port | The signaling connection. See [the protocol](../docs/protocol.md). |

## How it works

- A **room** pairs one host (the Chrome extension) with one guest (the phone).
- Room IDs and device IDs are standard UUIDs, for example from `crypto.randomUUID()`.
- Rooms live in memory. If the server restarts, rooms are lost, and the extension recreates its room by sending `host` again with the same ID.
- Either side can disconnect and come back to the same room until it expires.
- A new connection from the same host or the same phone replaces the old one.

## Limits

| Limit | Value |
|-------|-------|
| Message size | 64 KB |
| Time to identify after connecting (`host` or `join`) | 10 seconds |
| Heartbeat ping | every 15 seconds |
| Session length | `SESSION_MAX_MINUTES`, 180 by default |
| Devices per room | 1 host and 1 phone |

## Project layout

```
src/
├── index.js        Express app, WebSocket server, startup and shutdown
├── config.js       Settings and constants
├── rooms.js        In-memory room storage
├── signaling.js    Send, error, close and relay helpers
├── websocket.js    Connection setup and message routing
├── session.js      Heartbeat and room expiry
└── handlers/
    ├── host.js     host and close-room messages
    └── guest.js    join message
```

## Known limitations

- **No host authentication yet.** Anyone who knows a room ID can send `host` and take over the host's side of that room. Room IDs are random and only shared through the QR code, but a secret host token is planned.
- **State is in memory.** There is no database, and a restart ends all sessions until the extension reconnects.
- **No rate limiting.** Add it before exposing a server to heavy public traffic.