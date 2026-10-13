# FileDrop Server

A lightweight WebSocket signaling server for **FileDrop**, a peer-to-peer file-sharing application connecting Android phones and computers using WebRTC.

The server coordinates device connections and relays WebRTC signaling messages (`offer`, `answer`, and `ice-candidate`).

**Files are not uploaded to or stored by the signaling server.** File transfers are intended to happen directly between connected devices over a WebRTC data channel.

## Requirements

- Node.js 22 or newer (tested with Node.js 22.20.0)
- npm

## Quick Start

From the `server/` directory:

```bash
npm install
cp .env.example .env
npm run dev
```

Alternatively, start without automatic restarting:

```bash
npm start
```

The server listens on port `3000` by default.

### Health Check

Open:

```text
http://localhost:3000/health
```

Expected response when no rooms exist:

```json
{
  "ok": true,
  "rooms": 0
}
```

## Configuration

Configure the server using a `.env` file.

Example:

```dotenv
PORT=3000
SESSION_MAX_MINUTES=180
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5500
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP and WebSocket listening port |
| `SESSION_MAX_MINUTES` | `180` | Maximum room lifetime |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed WebSocket origins |

Restart the server after changing environment variables.

## Architecture

```text
Android Phone                  Chrome Extension
      |                               |
      |                               |
      +------ WebSocket Server -------+
                  |
             Signaling only
                  |
           Offer / Answer / ICE

Android Phone <==== WebRTC ====> Chrome Extension
                   |
             File Transfer
```

The signaling server does not transfer files. Its responsibility is to help devices establish a WebRTC connection.

## Connection Flow

### 1. Host creates a room

The Chrome extension connects to the signaling server and sends a `host` message containing:

- Room UUID
- Host authentication token
- Room expiration timestamp

The server creates the room and responds with `hosted`.

### 2. Phone joins

The phone scans the QR code and obtains the room UUID.

It connects to the signaling server and sends a `join` message with its device UUID.

On the first successful join, the server generates a guest authentication token and returns it in the `joined` response.

### 3. WebRTC negotiation

The server relays:

- `offer`
- `answer`
- `ice-candidate`

These messages establish the peer-to-peer connection.

### 4. Direct file transfer

After WebRTC negotiation succeeds, files can be transferred directly between the devices using a WebRTC data channel.

## Authentication

### Host authentication

Each room has a 64-character hexadecimal host token.

The host must provide the correct token to reclaim an existing room.

An incorrect token is rejected.

### Guest authentication

When a guest first joins a room, the server generates a cryptographically random guest token.

Subsequent guest connections must provide:

- The same device UUID
- The correct guest token

A different device cannot take over the existing guest session simply by knowing the room UUID.

### Session expiration

Rooms have a maximum lifetime of 180 minutes by default.

Expired rooms are cleaned up by the session manager.

Rooms are stored in memory and are not persisted across server restarts.

## Security and Limits

The server implements several protections.

| Protection | Current setting |
|---|---|
| Global WebSocket connection limit | 100 |
| Per-IP WebSocket connection limit | 5 |
| WebSocket message rate limit | 60 messages per 10 seconds per connection |
| Maximum WebSocket message size | 64 KB |
| Initial identification timeout | 10 seconds |
| Heartbeat interval | 15 seconds |
| Expired-room sweep interval | 30 seconds |
| Host token | 32 random bytes represented as 64 hexadecimal characters |
| Guest token | 32 random bytes represented as 64 hexadecimal characters |
| Origin policy | Explicit allowlist |

Additional validation is applied to WebRTC offers, answers, and ICE candidates.

**Important:** The current IP-based limits are intended for local development. Trusted reverse-proxy handling has not yet been implemented.

## WebSocket Messages

All signaling messages are JSON objects with a `type` field.

### Client-to-server messages

| Type | Sender | Important fields |
|---|---|---|
| `host` | Chrome extension | `room`, `hostToken`, `expiresAt` |
| `join` | Android client | `room`, `device`, optional `guestToken` for reconnecting |
| `offer` | Connected peer | `offer` |
| `answer` | Connected peer | `answer` |
| `ice-candidate` | Connected peer | `candidate` |
| `close-room` | Host | Room closure request |

### Server-to-client messages

The server supports signaling responses and notifications including:

- `hosted`
- `joined`
- `peer-joined`
- `peer-left`
- `host-joined`
- `host-left`
- `revoked`
- `room-closed`
- `expired`
- `error`

An error response has the following general structure:

```json
{
  "type": "error",
  "code": "not-found",
  "message": "Room not found"
}
```

## Project Structure

```text
server/
├── src/
│   ├── index.js
│   ├── config.js
│   ├── rooms.js
│   ├── session.js
│   ├── signaling.js
│   ├── websocket.js
│   │
│   ├── handlers/
│   │   ├── host.js
│   │   └── guest.js
│   │
│   └── middleware/
│       ├── originPolicy.js
│       ├── rateLimit.js
│       ├── connectionLimit.js
│       └── signalingValidation.js
│
├── test/
│   ├── host.test.js
│   ├── guest.test.js
│   ├── rateLimit.test.js
│   ├── connectionLimit.test.js
│   ├── signalingValidation.test.js
│   ├── websocketLimit.test.js
│   ├── websocketUpgrade.test.js
│   └── websocketDisconnect.test.js
│
├── .env.example
├── package.json
├── package-lock.json
└── README.md
```

## Testing

### Unit tests

Run:

```bash
node --test \
  test/connectionLimit.test.js \
  test/rateLimit.test.js \
  test/signalingValidation.test.js
```

Latest verified result:

```text
Tests: 21
Passed: 21
Failed: 0
```

### Integration tests

Start the server in one Terminal:

```bash
npm start
```

Run these tests in another Terminal:

```bash
node test/host.test.js
node test/guest.test.js
node test/websocketLimit.test.js
node test/websocketUpgrade.test.js
node test/websocketDisconnect.test.js
```

The integration tests cover:

- Host authorization and reconnection
- Guest authentication and device identity
- Per-IP connection limits
- Interrupted WebSocket handshakes
- Connection-slot reuse after disconnect
- Repeated connection and disconnection cycles

Tests that exercise the five-connection limit should run without other clients connected.

## Current Development Status

**Implemented and tested**

- HTTP health endpoint
- WebSocket signaling server
- In-memory rooms
- Host authentication
- Guest authentication
- Host and guest reconnection
- Session expiration management
- Origin allowlist
- Message rate limiting
- Connection limits
- WebRTC signaling payload validation
- WebSocket disconnect cleanup

**Next development priorities**

- Android browser client
- Chrome extension integration
- QR-code pairing
- WebRTC data channel file transfers
- File transfer progress and error handling
- End-to-end testing

## Known Limitations

- Rooms exist only in memory and are lost when the server restarts.
- There is no database or persistent session storage.
- Reverse-proxy client IP handling has not been implemented.
- The server does not provide TURN infrastructure for WebRTC connections that cannot be established directly.
- Complete end-to-end file-transfer behavior has not yet been verified for this new FileDrop project.

## Development Scope

FileDrop is currently being developed and tested locally.

Cloud hosting, production deployment, and public availability will be addressed in later development stages.

## License

See the repository's license information, if provided.
