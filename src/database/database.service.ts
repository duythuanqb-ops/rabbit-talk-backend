import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createPool, Pool, ResultSetHeader } from 'mysql2/promise';
import config from '../config';

export type SqlParam =
  | string
  | number
  | boolean
  | null
  | Date
  | Buffer
  | SqlParam[];

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
      multipleStatements: true,
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParam[],
  ): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params?: SqlParam[]): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute(sql, params);
    return result as ResultSetHeader;
  }

  async getConnection() {
    return await this.pool.getConnection();
  }
}
