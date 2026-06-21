import path from "node:path";
import Postgrator from "postgrator";
import { getDatabase, type Database } from "./index";

/**
 * Kör databasmigreringar med Postgrator mot målversionen (default: senaste).
 *
 * Körs under runExclusive (advisory lock) så att samtidig uppstart av flera
 * instanser inte racear migreringarna.
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
      // Inget `database` behövs: information_schema innehåller bara den aktuella
      // databasen, så Postgrators "finns tabellen?"-koll fungerar utan ett
      // table_catalog-filter.
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
