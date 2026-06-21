import path from "node:path";
import { Client } from "pg";
import Postgrator from "postgrator";
import { getDbConfig } from "./db/config";

/**
 * Kör databasmigreringar med Postgrator.
 *
 * Användning:
 *   npm run migrate            -> migrera till senaste versionen
 *   npm run migrate -- 002     -> migrera till en specifik version
 *   npm run migrate -- 000     -> rulla tillbaka alla migreringar
 */
async function main(): Promise<void> {
  const target = process.argv[2];
  const config = getDbConfig();
  const client = new Client(config);

  await client.connect();

  try {
    const postgrator = new Postgrator({
      driver: "pg",
      database: config.database ?? "kalle",
      migrationPattern: path.join(__dirname, "..", "migrations", "*"),
      schemaTable: "schemaversion",
      execQuery: (query) => client.query(query),
    });

    postgrator.on("migration-started", (m) =>
      console.log(`→ ${m.action} ${m.version}: ${m.name}`),
    );

    const applied = await postgrator.migrate(target);

    if (applied.length === 0) {
      console.log("Inga migreringar att köra – databasen är redan uppdaterad.");
    } else {
      console.log(`Klart. ${applied.length} migrering(ar) kördes.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migrering misslyckades:", err);
  process.exitCode = 1;
});
