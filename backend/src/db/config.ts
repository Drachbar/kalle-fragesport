import type { ClientConfig } from "pg";

/**
 * Bygger anslutningskonfiguration till Postgres från miljövariabler.
 *
 * Använder `DATABASE_URL` om den är satt (t.ex. i produktion), annars
 * enskilda `PG*`-variabler med standardvärden som matchar `compose.yaml`
 * för lokal utveckling.
 */
export function getDbConfig(env: NodeJS.ProcessEnv = process.env): ClientConfig {
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL };
  }

  return {
    host: env.PGHOST ?? "localhost",
    port: Number(env.PGPORT ?? 5432),
    user: env.PGUSER ?? "kalle",
    password: env.PGPASSWORD ?? "kalle",
    database: env.PGDATABASE ?? "kalle",
  };
}
