import { config } from 'dotenv';
config();

import { randomBytes } from 'crypto';

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';

if (!process.env.JWT_SECRET && env === 'production') {
  throw new Error('JWT_SECRET environment variable is missing in production!');
}

const configuration = {
  nodeEnv: env,
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_DATABASE ?? 'ribbittalk',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3004',
  jwt: {
    secret: process.env.JWT_SECRET ?? (env === 'development' ? 'secretKey' : randomBytes(32).toString('hex')),
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
} as const;

export default configuration;
export const environment = env;
