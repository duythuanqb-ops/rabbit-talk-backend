import development from './development';
import production from './production';

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const baseConfig = env === 'production' ? production : development;

const config = {
  nodeEnv: env,
  port: Number(process.env.PORT ?? baseConfig.port),
  db: {
    host: process.env.DB_HOST ?? baseConfig.db.host,
    port: Number(process.env.DB_PORT ?? baseConfig.db.port),
    user: process.env.DB_USER ?? baseConfig.db.user,
    password: process.env.DB_PASSWORD ?? baseConfig.db.password,
    database: process.env.DB_DATABASE ?? baseConfig.db.database,
  },
  frontendUrl: process.env.FRONTEND_URL ?? baseConfig.frontendUrl,
} as const;

export default config;
export const environment = env;
