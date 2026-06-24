export interface QueryResult<T> {
  rows: T[];
  /** Antal rader som påverkades (DELETE/UPDATE) eller returnerades. */
  rowCount: number;
}

/** Tunn abstraktion över databasen (node-postgres). */
export interface Database {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;

  /** Kör ett SQL-skript med flera satser (används av migreringar). */
  exec(sql: string): Promise<void>;

  /**
   * Kör fn med garanti att inga andra instanser migrerar samtidigt
   * (Postgres advisory lock).
   */
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Försöker ta ett advisory lock för `lockKey` utan att blockera. Lyckas det
   * körs fn (med låset hållet) och resultatet returneras. Tas låset inte
   * (en annan instans håller det) returneras null och fn körs inte.
   */
  tryRunExclusive<T>(lockKey: number, fn: () => Promise<T>): Promise<T | null>;

  close(): Promise<void>;
}
