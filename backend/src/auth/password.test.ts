import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashar lösenordet till något annat än klartexten", async () => {
    const hash = await hashPassword("hemligt123");

    expect(hash).not.toBe("hemligt123");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("ger olika hashar för samma lösenord (salt)", async () => {
    const a = await hashPassword("hemligt123");
    const b = await hashPassword("hemligt123");

    expect(a).not.toBe(b);
  });

  it("verifierar ett korrekt lösenord mot sin hash", async () => {
    const hash = await hashPassword("hemligt123");

    await expect(verifyPassword("hemligt123", hash)).resolves.toBe(true);
  });

  it("avvisar ett felaktigt lösenord", async () => {
    const hash = await hashPassword("hemligt123");

    await expect(verifyPassword("fel-lösenord", hash)).resolves.toBe(false);
  });
});
