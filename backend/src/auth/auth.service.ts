import { hashPassword, verifyPassword } from "./password";
import { usersRepository, type UsersRepository } from "../users/users.repository";
import type { User } from "../users/users.types";

/** Kastas när registrering sker med en e-post som redan finns. */
export class EmailAlreadyInUseError extends Error {
  constructor() {
    super("E-postadressen är redan registrerad");
    this.name = "EmailAlreadyInUseError";
  }
}

/** True om felet är en unik-constraint-överträdelse i Postgres. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Registrerar en ny användare med roll 'user'. Lösenordet hashas innan lagring.
 * Kastar EmailAlreadyInUseError om e-posten redan är tagen.
 */
export async function registerUser(
  email: string,
  password: string,
  repo: UsersRepository = usersRepository,
): Promise<User> {
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    throw new EmailAlreadyInUseError();
  }

  const passwordHash = await hashPassword(password);

  try {
    return await repo.createUser({ email, passwordHash, role: "user" });
  } catch (err) {
    // Skydd mot race: två samtidiga registreringar av samma e-post.
    if (isUniqueViolation(err)) {
      throw new EmailAlreadyInUseError();
    }
    throw err;
  }
}

/**
 * Verifierar inloggningsuppgifter. Returnerar användaren vid korrekt lösenord,
 * annars null (samma resultat för okänd e-post och fel lösenord).
 */
export async function loginUser(
  email: string,
  password: string,
  repo: UsersRepository = usersRepository,
): Promise<User | null> {
  const user = await repo.findUserByEmail(email);
  if (!user) {
    return null;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}
