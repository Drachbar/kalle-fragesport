import { getDatabase } from "./db";
import { runMigrations } from "./db/migrate";
import { hashPassword } from "./auth/password";
import { normalizeEmail } from "./users/users.repository";
import { loadBackendEnv } from "./load-env";

loadBackendEnv();

/**
 * CLI för att skapa (eller återställa) ett adminkonto.
 *
 * Användning:
 *   npm run create-admin -- <e-post> <lösenord>
 *
 * Idempotent: körs den för en befintlig e-post uppdateras lösenordet och
 * rollen sätts till admin.
 */
async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Användning: npm run create-admin -- <e-post> <lösenord>");
    process.exitCode = 1;
    return;
  }

  // Säkerställ att schemat finns (viktigt vid en färsk databas).
  await runMigrations();

  const passwordHash = await hashPassword(password);
  const result = await getDatabase().query<{
    id: string;
    email: string;
    role: string;
  }>(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'admin'
     RETURNING id, email, role`,
    [normalizeEmail(email), passwordHash],
  );

  const admin = result.rows[0];
  console.log(`Admin redo: ${admin.email} (${admin.role}), id=${admin.id}`);
}

main()
  .catch((err) => {
    console.error("Kunde inte skapa admin:", err);
    process.exitCode = 1;
  })
  .finally(() => getDatabase().close());
