import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createSettingsRouter, type SettingsRouterDeps } from "./settings.routes";
import type { Role } from "../users/users.types";

function makeDeps(over: Partial<SettingsRouterDeps> = {}): SettingsRouterDeps {
  return {
    keysRepo: {
      setKey: vi.fn().mockResolvedValue(undefined),
      getEncryptedKey: vi.fn().mockResolvedValue(null),
      deleteKey: vi.fn().mockResolvedValue(undefined),
    },
    encrypt: vi.fn((plaintext: string) => `enc(${plaintext})`),
    isEnvKeyPresent: vi.fn(() => false),
    ...over,
  };
}

function makeApp(deps: SettingsRouterDeps, session: { userId?: string; role?: Role } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: unknown }).session = session;
    next();
  });
  app.use("/settings", createSettingsRouter(deps));
  return app;
}

const adminSession = { userId: "admin-1", role: "admin" as Role };
const userSession = { userId: "user-1", role: "user" as Role };

describe("GET /settings/openai-key", () => {
  it("returnerar envKeyPresent och userKeySet", async () => {
    const deps = makeDeps({
      isEnvKeyPresent: vi.fn(() => true),
      keysRepo: {
        setKey: vi.fn(),
        getEncryptedKey: vi.fn().mockResolvedValue("enc(sk-x)"),
        deleteKey: vi.fn(),
      },
    });
    const res = await request(makeApp(deps, adminSession)).get("/settings/openai-key");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ envKeyPresent: true, userKeySet: true });
    expect(deps.keysRepo.getEncryptedKey).toHaveBeenCalledWith("admin-1");
  });

  it("userKeySet är false när användaren saknar nyckel", async () => {
    const res = await request(makeApp(makeDeps(), adminSession)).get("/settings/openai-key");
    expect(res.body).toEqual({ envKeyPresent: false, userKeySet: false });
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(makeDeps(), userSession)).get("/settings/openai-key");
    expect(res.status).toBe(403);
  });

  it("svarar 401 för oinloggad", async () => {
    const res = await request(makeApp(makeDeps())).get("/settings/openai-key");
    expect(res.status).toBe(401);
  });
});

describe("PUT /settings/openai-key", () => {
  it("krypterar och sparar nyckeln, svarar 204", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession))
      .put("/settings/openai-key")
      .send({ apiKey: "sk-min-hemliga-nyckel" });

    expect(res.status).toBe(204);
    expect(deps.encrypt).toHaveBeenCalledWith("sk-min-hemliga-nyckel");
    expect(deps.keysRepo.setKey).toHaveBeenCalledWith(
      "admin-1",
      "enc(sk-min-hemliga-nyckel)",
    );
  });

  it("svarar 400 för nyckel med fel format", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession))
      .put("/settings/openai-key")
      .send({ apiKey: "inte-en-nyckel" });

    expect(res.status).toBe(400);
    expect(deps.keysRepo.setKey).not.toHaveBeenCalled();
  });

  it("svarar 400 för tom body", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession))
      .put("/settings/openai-key")
      .send({});

    expect(res.status).toBe(400);
    expect(deps.keysRepo.setKey).not.toHaveBeenCalled();
  });

  it("läcker aldrig klartextnyckeln i svaret", async () => {
    const res = await request(makeApp(makeDeps(), adminSession))
      .put("/settings/openai-key")
      .send({ apiKey: "sk-hemlig" });

    expect(res.text).not.toContain("sk-hemlig");
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(makeDeps(), userSession))
      .put("/settings/openai-key")
      .send({ apiKey: "sk-x" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /settings/openai-key", () => {
  it("tar bort nyckeln, svarar 204", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession)).delete("/settings/openai-key");

    expect(res.status).toBe(204);
    expect(deps.keysRepo.deleteKey).toHaveBeenCalledWith("admin-1");
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(makeDeps(), userSession)).delete("/settings/openai-key");
    expect(res.status).toBe(403);
  });
});
