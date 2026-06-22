import { getDatabase } from "../db";

/**
 * Lagrar en användares krypterade OpenAI-nyckel. Nyckeln krypteras i app-lagret
 * (se security/crypto) – här hanteras enbart den krypterade strängen.
 */
export interface OpenAiKeysRepository {
  setKey(userId: string, encryptedKey: string): Promise<void>;
  getEncryptedKey(userId: string): Promise<string | null>;
  deleteKey(userId: string): Promise<void>;
}

interface KeyRow {
  encrypted_key: string;
}

export const openAiKeysRepository: OpenAiKeysRepository = {
  async setKey(userId, encryptedKey) {
    await getDatabase().query(
      `INSERT INTO user_openai_keys (user_id, encrypted_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key`,
      [userId, encryptedKey],
    );
  },

  async getEncryptedKey(userId) {
    const result = await getDatabase().query<KeyRow>(
      `SELECT encrypted_key FROM user_openai_keys WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0]?.encrypted_key ?? null;
  },

  async deleteKey(userId) {
    await getDatabase().query(
      `DELETE FROM user_openai_keys WHERE user_id = $1`,
      [userId],
    );
  },
};
