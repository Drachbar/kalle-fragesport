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

/** Kastas när ett angivet lösenord inte stämmer (eller användaren saknas). */
export class InvalidPasswordError extends Error {
  constructor() {
    super("Fel lösenord");
    this.name = "InvalidPasswordError";
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

/**
 * Byter lösenord för en användare. Kräver att nuvarande lösenord stämmer,
 * annars kastas InvalidPasswordError (även om användaren saknas).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  repo: UsersRepository = usersRepository,
): Promise<void> {
  const user = await repo.findUserById(userId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new InvalidPasswordError();
  }

  const passwordHash = await hashPassword(newPassword);
  await repo.updatePassword(userId, passwordHash);
}

/**
 * Raderar en användares konto. Kräver att lösenordet stämmer, annars kastas
 * InvalidPasswordError (även om användaren saknas).
 */
export async function deleteAccount(
  userId: string,
  password: string,
  repo: UsersRepository = usersRepository,
): Promise<void> {
  const user = await repo.findUserById(userId);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new InvalidPasswordError();
  }

  await repo.deleteUser(userId);
}
