export interface QueryResult<T> {
  rows: T[];
  /** Antal rader som påverkades (DELETE/UPDATE) eller returnerades. */
  rowCount: number;
}

/**
 * Databasabstraktion som både riktig Postgres (pg) och PGlite implementerar.
 * SQL-dialekten är densamma (Postgres) – bara körningen skiljer.
 */
export interface Database {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;

  /** Kör ett SQL-skript med flera satser (används av migreringar). */
  exec(sql: string): Promise<void>;

  /**
   * Kör fn med garanti att inga andra processer migrerar samtidigt.
   * För pg används ett advisory lock; PGlite är enprocessigt och kör direkt.
   */
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}
