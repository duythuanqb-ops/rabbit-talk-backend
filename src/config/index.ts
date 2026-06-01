import { randomBytes } from 'crypto';

const env =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

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
    secret:
      process.env.JWT_SECRET ??
      (env === 'development' ? 'secretKey' : randomBytes(32).toString('hex')),
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  mail: {
    host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT ?? 587),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM ?? `"RibbitTalk" <noreply@ribbittalk.com>`,
  },
  aws: {
    s3Region: process.env.AWS_S3_REGION ?? '',
    s3Bucket: process.env.AWS_S3_BUCKET ?? '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
  },
} as const;

export default configuration;
export const environment = env;
