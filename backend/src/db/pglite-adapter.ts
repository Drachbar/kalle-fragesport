import { PGlite } from "@electric-sql/pglite";
import type { Database, QueryResult } from "./database";

/**
 * PGlite-adapter: riktig Postgres kompilerad till WASM, in-process.
 * Kräver bara Node – ingen Docker eller externa binärer.
 */
export class PgliteDatabase implements Database {
  private readonly pg: PGlite;

  /**
   * @param dataDir Sökväg för persistent lagring. Utelämna (eller "memory://")
   *                för en in-memory-databas (t.ex. i tester).
   */
  constructor(dataDir?: string) {
    this.pg = new PGlite(dataDir);
  }

  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const result = await this.pg.query<T>(text, params ? [...params] : undefined);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.pg.exec(sql);
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    // PGlite är enprocessigt – ingen samtidighet att skydda mot.
    return fn();
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}
