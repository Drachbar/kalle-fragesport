import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret } from "./crypto";

// 32-byte nyckel i hex (matchar genereringskommandot i .env.example).
const key = randomBytes(32).toString("hex");
const env = { API_KEY_ENCRYPTION_KEY: key } as NodeJS.ProcessEnv;

describe("crypto", () => {
  it("krypterar och dekrypterar tillbaka originalet (round-trip)", () => {
    const plaintext = "sk-abc123-hemlig-nyckel";
    const encrypted = encryptSecret(plaintext, env);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted, env)).toBe(plaintext);
  });

  it("ger olika output för samma text (slumpad IV)", () => {
    const plaintext = "sk-samma-text";
    const a = encryptSecret(plaintext, env);
    const b = encryptSecret(plaintext, env);

    expect(a).not.toBe(b);
    expect(decryptSecret(a, env)).toBe(plaintext);
    expect(decryptSecret(b, env)).toBe(plaintext);
  });

  it("kastar om payloaden manipulerats (auth-tag stämmer inte)", () => {
    const encrypted = encryptSecret("sk-orörd", env);
    const [iv, tag, ciphertext] = encrypted.split(":");
    // Byt ut ciphertext mot något annat → autentisering ska misslyckas.
    const tampered = [iv, tag, Buffer.from("annat").toString("base64")].join(
      ":",
    );

    expect(() => decryptSecret(tampered, env)).toThrow();
  });

  it("kastar tydligt om krypteringsnyckeln saknas", () => {
    expect(() => encryptSecret("x", {} as NodeJS.ProcessEnv)).toThrow(
      /API_KEY_ENCRYPTION_KEY/,
    );
  });

  it("accepterar en hemlighet av valfri längd (härleder 32-byte nyckel)", () => {
    const shortEnv = {
      API_KEY_ENCRYPTION_KEY: "min-korta-hemlighet",
    } as NodeJS.ProcessEnv;
    const encrypted = encryptSecret("sk-test", shortEnv);
    expect(decryptSecret(encrypted, shortEnv)).toBe("sk-test");
  });
});
