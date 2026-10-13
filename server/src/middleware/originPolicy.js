
import { config } from '../config.js';

export function isAllowedOrigin(origin) {
  if (typeof origin !== 'string' || !origin) {
    return false;
  }

  return config.allowedOrigins.includes(origin);
}
