import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createPool, Pool } from 'mysql2/promise';
import config from '../config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  onModuleInit() {
    this.pool = createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const [result] = await this.pool.execute(sql, params);
    return result;
  }
}
