import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Symmetrisk kryptering av hemligheter (t.ex. en användares OpenAI-nyckel) med
 * AES-256-GCM. Endast Nodes inbyggda crypto används – inga externa beroenden.
 *
 * En 32-byte nyckel härleds från miljövariabeln API_KEY_ENCRYPTION_KEY via
 * SHA-256, så vilken icke-tom hemlighet som helst fungerar (oavsett längd/format).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Rekommenderad IV-längd för GCM.

function loadKey(env: NodeJS.ProcessEnv): Buffer {
  const raw = env.API_KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY måste sättas för att kryptera/dekryptera hemligheter",
    );
  }

  // Härled alltid en 32-byte nyckel oavsett hur hemligheten är formaterad.
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Krypterar en sträng. Returnerar "iv:authTag:ciphertext" (base64-delar). */
export function encryptSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = loadKey(env);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Dekrypterar en payload skapad av {@link encryptSecret}. */
export function decryptSecret(
  payload: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = loadKey(env);
  const [ivPart, tagPart, dataPart] = payload.split(":");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Ogiltig krypterad payload");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
