
const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 10_000;

/**
 * Creates a rate limiter for a single WebSocket connection.
 *
 * Each connection gets its own independent counter.
 */
export function createRateLimiter({
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
} = {}) {
  let count = 0;
  let windowStart = Date.now();

  return function allowMessage() {
    const now = Date.now();

    if (now - windowStart >= windowMs) {
      count = 0;
      windowStart = now;
    }

    count++;

    return count <= limit;
  };
}
