import { runMigrations } from "./db/migrate";
import { getDatabase } from "./db";
import { loadBackendEnv } from "./load-env";

loadBackendEnv();

/**
 * CLI för databasmigreringar.
 *
 * Användning:
 *   npm run migrate            -> migrera till senaste versionen
 *   npm run migrate -- 002     -> migrera till en specifik version
 *   npm run migrate -- 000     -> rulla tillbaka alla migreringar
 */
async function main(): Promise<void> {
  const target = process.argv[2];
  const applied = await runMigrations(target);

  if (applied.length === 0) {
    console.log("Inga migreringar att köra – databasen är redan uppdaterad.");
  } else {
    console.log(`Klart. ${applied.length} migrering(ar) kördes.`);
  }
}

main()
  .catch((err) => {
    console.error("Migrering misslyckades:", err);
    process.exitCode = 1;
  })
  .finally(() => getDatabase().close());
