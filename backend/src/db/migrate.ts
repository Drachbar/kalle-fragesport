import path from "node:path";
import Postgrator from "postgrator";
import { getDatabase, type Database } from "./index";

/**
 * Kör databasmigreringar med Postgrator mot målversionen (default: senaste).
 *
 * Fungerar mot både PGlite och riktig Postgres via databasabstraktionen.
 * Körs under runExclusive så att samtidig uppstart av flera instanser (pg)
 * inte racear migreringarna.
 *
 * @param target Versionsnummer att migrera till, t.ex. "002". "000" rullar
 *               tillbaka allt. Utelämnas för senaste versionen.
 */
export async function runMigrations(
  target?: string,
  database: Database = getDatabase(),
) {
  return database.runExclusive(async () => {
    const postgrator = new Postgrator({
      driver: "pg",
      // Inget `database`: Postgrator filtrerar annars sin "finns tabellen?"-koll
      // på table_catalog = <database>, vilket inte matchar PGlite:s faktiska
      // databasnamn. information_schema innehåller ändå bara aktuell databas.
      migrationPattern: path.join(__dirname, "..", "..", "migrations", "*"),
      schemaTable: "schemaversion",
      execQuery: (query) => database.query(query),
      execSqlScript: (sqlScript) => database.exec(sqlScript),
    });

    postgrator.on("migration-started", (m) =>
      console.log(`→ ${m.action} ${m.version}: ${m.name}`),
    );

    return postgrator.migrate(target);
  });
}
