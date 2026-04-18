export default {
  nodeEnv: 'production',
  port: 3000,
  db: {
    host: 'mysql',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'ribbittalk',
  },
  frontendUrl: 'http://localhost:3004',
} as const;
