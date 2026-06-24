import { createHash, randomBytes } from "node:crypto";
import { getDatabase, type Database } from "../db";

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class InvalidEmailVerificationTokenError extends Error {
  constructor() {
    super("Ogiltig eller utgången verifieringslänk");
    this.name = "InvalidEmailVerificationTokenError";
  }
}

export interface EmailVerificationTokensRepository {
  createToken(userId: string): Promise<string>;
  verifyToken(token: string): Promise<void>;
}

export function createEmailVerificationTokensRepository(
  database: Database = getDatabase(),
): EmailVerificationTokensRepository {
  return {
    async createToken(userId) {
      const token = randomBytes(TOKEN_BYTES).toString("base64url");
      await database.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3::text || ' hours')::interval)`,
        [userId, hashToken(token), TOKEN_TTL_HOURS],
      );
      return token;
    },

    async verifyToken(token) {
      const result = await database.query<{ id: string }>(
        `WITH token AS (
           SELECT id, user_id
             FROM email_verification_tokens
            WHERE token_hash = $1
              AND expires_at > now()
         ),
         usable_token AS (
           UPDATE email_verification_tokens evt
              SET used_at = COALESCE(evt.used_at, now())
             FROM token
            WHERE evt.id = token.id
              AND (
                evt.used_at IS NULL
                OR EXISTS (
                  SELECT 1
                    FROM users
                   WHERE users.id = token.user_id
                     AND users.email_verified_at IS NOT NULL
                )
              )
            RETURNING token.user_id
         )
         UPDATE users
            SET email_verified_at = COALESCE(email_verified_at, now())
          WHERE id = (SELECT user_id FROM usable_token)
          RETURNING id`,
        [hashToken(token)],
      );

      if (result.rowCount === 0) {
        throw new InvalidEmailVerificationTokenError();
      }
    },
  };
}

export const emailVerificationTokensRepository =
  createEmailVerificationTokensRepository();
