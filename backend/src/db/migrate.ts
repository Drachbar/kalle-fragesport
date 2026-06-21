import path from "node:path";
import { Client } from "pg";
import Postgrator from "postgrator";
import { getDbConfig } from "./config";

// Godtycklig men fast nyckel för advisory lock så att två instanser inte
// kör migreringar samtidigt vid uppstart.
const MIGRATION_LOCK_KEY = 827_493_001;

/**
 * Kör databasmigreringar med Postgrator mot målversionen (default: senaste).
 *
 * Tar ett Postgres advisory lock under körningen så att samtidig uppstart av
 * flera app-instanser inte racear migreringarna.
 *
 * @param target Versionsnummer att migrera till, t.ex. "002". "000" rullar
 *               tillbaka allt. Utelämnas för senaste versionen.
 * @returns De migreringar som faktiskt kördes.
 */
export async function runMigrations(target?: string) {
  const config = getDbConfig();
  const client = new Client(config);

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

    try {
      const postgrator = new Postgrator({
        driver: "pg",
        database: config.database ?? "kalle",
        migrationPattern: path.join(__dirname, "..", "..", "migrations", "*"),
        schemaTable: "schemaversion",
        execQuery: (query) => client.query(query),
      });

      postgrator.on("migration-started", (m) =>
        console.log(`→ ${m.action} ${m.version}: ${m.name}`),
      );

      return await postgrator.migrate(target);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}
