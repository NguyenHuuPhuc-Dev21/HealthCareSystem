/**
 * Core Database Service (BE-1)
 * PostgreSQL Connection Pool — ADR-0002 (SQL-First)
 */
import { Pool, PoolClient } from 'pg';

export class DatabasePool {
  private static instance: DatabasePool;
  private pool?: Pool;

  private constructor() {}

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) DatabasePool.instance = new DatabasePool();
    return DatabasePool.instance;
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      });
    }
    return this.pool;
  }

  public async connect(): Promise<void> {
    await this.getPool().query('SELECT 1');
    console.log('[Core/Database] Connected to PostgreSQL pool');
  }

  public async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
    const res = await this.getPool().query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  }

  /** Chạy fn trong 1 transaction: lỗi → ROLLBACK toàn bộ */
  public async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool?.end();
    this.pool = undefined;
  }

  /** Calculates Haversine distance in meters between two lat/lng pairs */
  public static calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export const db = DatabasePool.getInstance();