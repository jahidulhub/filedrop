
import 'dotenv/config';

function readInteger(name, defaultValue, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `Invalid ${name}: expected an integer between ${min} and ${max}`
    );
  }

  return value;
}

const port = readInteger('PORT', 3000, 1, 65535);

const sessionMinutes = readInteger(
  'SESSION_MAX_MINUTES',
  180,
  1,
  1440
);

export const config = Object.freeze({
  port,

  // Maximum session length.
  sessionMs: sessionMinutes * 60 * 1000,

  // Allowed difference between client and server clocks.
  clockSlackMs: 60 * 1000,

  // WebSocket heartbeat interval.
  heartbeatMs: 15 * 1000,

  // Expired-room cleanup interval.
  sweepMs: 30 * 1000,

  // Time allowed to identify a new connection.
  joinTimeoutMs: 10 * 1000,

  // Maximum incoming WebSocket message size.
  maxPayloadBytes: 64 * 1024,

  // UUID format for room and device identifiers.
  idPattern:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  
  
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:3000'
  )
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

});
