import type { Database } from "./database";
import { PgDatabase } from "./pg-adapter";

export type { Database, QueryResult } from "./database";

let instance: Database | undefined;

/** Hämtar (och skapar vid behov) den delade databasinstansen. */
export function getDatabase(): Database {
  if (!instance) {
    instance = new PgDatabase();
  }
  return instance;
}
