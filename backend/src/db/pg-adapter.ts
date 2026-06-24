import { Pool } from "pg";
import { getDbConfig } from "./config";
import type { Database, QueryResult } from "./database";

// Fast nyckel för advisory lock så att flera instanser inte migrerar samtidigt.
const MIGRATION_LOCK_KEY = 827_493_001;

/** Adapter för riktig Postgres via node-postgres (pg). */
export class PgDatabase implements Database {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool(getDbConfig());
  }

  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const result = await this.pool.query(text, params as unknown[] | undefined);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      try {
        return await fn();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }

  async tryRunExclusive<T>(
    lockKey: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const client = await this.pool.connect();
    try {
      const res = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [lockKey],
      );
      if (!res.rows[0]?.locked) {
        return null;
      }
      try {
        return await fn();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
      }
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
