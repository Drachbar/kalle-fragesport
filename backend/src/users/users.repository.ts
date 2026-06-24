import { getDatabase } from "../db";
import type { NewUser, Role, User } from "./users.types";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLUMNS =
  "id, email, password_hash, role, email_verified_at, created_at, updated_at";

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Normaliserar e-post (trimmad + gemener) för konsekvent lagring/uppslag. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface UsersRepository {
  createUser(input: NewUser): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export const usersRepository: UsersRepository = {
  async createUser({ email, passwordHash, role = "user" }) {
    const result = await getDatabase().query<UserRow>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_COLUMNS}`,
      [normalizeEmail(email), passwordHash, role],
    );
    return mapRow(result.rows[0]);
  },

  async findUserByEmail(email) {
    const result = await getDatabase().query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`,
      [normalizeEmail(email)],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async findUserById(id) {
    const result = await getDatabase().query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async updatePassword(id, passwordHash) {
    // updated_at sätts av triggern users_set_updated_at.
    await getDatabase().query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [id, passwordHash],
    );
  },

  async deleteUser(id) {
    // user_openai_keys raderas via ON DELETE CASCADE.
    await getDatabase().query(`DELETE FROM users WHERE id = $1`, [id]);
  },
};
