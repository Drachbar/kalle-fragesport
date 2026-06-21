import type { Database } from "./database";
import { PgDatabase } from "./pg-adapter";
import { PgliteDatabase } from "./pglite-adapter";

export type { Database, QueryResult } from "./database";

let instance: Database | undefined;

function createFromEnv(): Database {
  // Riktig Postgres om DATABASE_URL är satt (eller DB_DRIVER=pg), annars PGlite.
  const usePg =
    Boolean(process.env.DATABASE_URL) || process.env.DB_DRIVER === "pg";
  if (usePg) {
    return new PgDatabase();
  }
  return new PgliteDatabase(process.env.PGLITE_DATA_DIR ?? "./pgdata");
}

/** Hämtar (och skapar vid behov) den delade databasinstansen. */
export function getDatabase(): Database {
  if (!instance) {
    instance = createFromEnv();
  }
  return instance;
}

/** Sätter databasinstansen explicit. Främst för tester (in-memory PGlite). */
export function setDatabase(db: Database): void {
  instance = db;
}
