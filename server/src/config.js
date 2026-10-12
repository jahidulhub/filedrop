import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,

  // Maximum session length. Default is 3 hours.
  sessionMs: (Number(process.env.SESSION_MAX_MINUTES) || 180) * 60 * 1000,

  // Allowed difference between the host's clock and the server's clock.
  clockSlackMs: 60 * 1000,

  // How often to ping clients and drop dead connections.
  heartbeatMs: 15 * 1000,

  // How often to check for expired rooms.
  sweepMs: 30 * 1000,

  // A new connection must identify itself within this time.
  joinTimeoutMs: 10 * 1000,

  // Largest message the server accepts.
  maxPayloadBytes: 64 * 1024,

  // Room IDs and device IDs must be standard UUIDs,
  // for example the output of crypto.randomUUID().
  idPattern:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};