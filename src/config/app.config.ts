import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT, 10) || 3000,
  env: process.env.APP_ENV || 'development',
  name: process.env.APP_NAME || 'idempiere-middleware',
}));

export const dbConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_DATABASE || 'middledb',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN, 10) || 3600,
}));

export const idempiereConfig = registerAs('idempiere', () => ({
  baseUrl: process.env.IDEMPIERE_BASE_URL,
  clientId: process.env.IDEMPIERE_CLIENT_ID,
  orgId: process.env.IDEMPIERE_ORG_ID,
  roleId: process.env.IDEMPIERE_ROLE_ID,
  warehouseId: process.env.IDEMPIERE_WAREHOUSE_ID,
  language: process.env.IDEMPIERE_LANGUAGE || 'en_US',
  token: process.env.IDEMPIERE_TOKEN,  // ← token langsung dari env
}));

export const syncConfig = registerAs('sync', () => ({
  productCron: process.env.SYNC_PRODUCT_CRON || '0 */30 * * * *',
  priceCron: process.env.SYNC_PRICE_CRON || '0 */15 * * * *',
}));
