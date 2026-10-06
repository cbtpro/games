import { registerAs } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

const toBool = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

/** 数据库配置集中在一处，全部可通过环境变量覆盖 */
export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions & { synchronize: boolean } => ({
    type: 'mysql',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'games',
    password: process.env.DB_PASSWORD ?? 'games',
    database: process.env.DB_DATABASE ?? 'games',
    charset: 'utf8mb4',
    timezone: '+08:00',
    // 实体用 glob 注册，新增实体无需改配置（开闭原则）
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: toBool(process.env.DB_SYNC, true),
    logging: toBool(process.env.DB_LOGGING, false),
    // 连接抖动时自动重连，避免一次网络故障打挂服务
    retryAttempts: 10,
    retryDelay: 3000,
    keepConnectionAlive: true,
    extra: {
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
    },
  }),
);
