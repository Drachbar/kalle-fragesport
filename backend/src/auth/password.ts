import bcrypt from "bcrypt";

// Kostnadsfaktor för bcrypt. 12 är en rimlig avvägning mellan säkerhet och
// inloggningstid för en liten applikation.
const SALT_ROUNDS = 12;

/** Hashar ett lösenord i klartext med bcrypt (inklusive salt). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verifierar ett lösenord i klartext mot en bcrypt-hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
