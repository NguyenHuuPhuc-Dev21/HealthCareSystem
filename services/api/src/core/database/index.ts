/**
 * Core Database Service (BE-1)
 * PostgreSQL Connection Pool & PostGIS/Haversine Spatial Distance Helpers
 * Follows ADR-0002 (SQL-First Data Layer)
 */

export interface DbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
}

export class DatabasePool {
  private static instance: DatabasePool;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  public async connect(): Promise<void> {
    // In production, instantiate pg.Pool
    this.isConnected = true;
    console.log('[Core/Database] Connected to PostgreSQL pool');
  }

  public async query<T = unknown>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
    if (!this.isConnected) {
      await this.connect();
    }
    // Execution stub for phase 0
    return { rows: [], rowCount: 0 };
  }

  /**
   * Calculates Haversine distance in meters between two lat/lng pairs
   */
  public static calculateHaversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const db = DatabasePool.getInstance();

