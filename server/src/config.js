import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  sessionMaxMs: (Number(process.env.SESSION_MAX_MINUTES) || 180) * 60 * 1000,
};
