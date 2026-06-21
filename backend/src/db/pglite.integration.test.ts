import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promisify } from "node:util";
import { PgliteDatabase } from "./pglite-adapter";
import { setDatabase, type Database } from "./index";
import { runMigrations } from "./migrate";
import { usersRepository } from "../users/users.repository";
import { questionsRepository } from "../questions/questions.repository";
import { DbSessionStore } from "../auth/session-store";
import type { SessionData } from "express-session";

// Integrationstest mot en riktig (in-memory) PGlite – bevisar att schemat,
// triggers, jsonb och uuid fungerar utan Docker/Postgres.

let db: Database;

beforeAll(async () => {
  db = new PgliteDatabase("memory://");
  setDatabase(db);
  await runMigrations(undefined, db);
});

afterAll(async () => {
  await db.close();
});

describe("migreringar på PGlite", () => {
  it("har kört alla tre migreringarna", async () => {
    const version = await db.query<{ version: number }>(
      "SELECT MAX(version)::int AS version FROM schemaversion",
    );
    expect(version.rows[0].version).toBe(3);
  });

  it("är idempotent – att köra igen mot befintlig databas kastar inte", async () => {
    // Motsvarar att starta appen en andra gång (schemaversion finns redan).
    const applied = await runMigrations(undefined, db);
    expect(applied).toEqual([]);

    const version = await db.query<{ version: number }>(
      "SELECT MAX(version)::int AS version FROM schemaversion",
    );
    expect(version.rows[0].version).toBe(3);
  });
});

describe("usersRepository mot PGlite", () => {
  it("skapar och hämtar en användare med genererat uuid", async () => {
    const created = await usersRepository.createUser({
      email: "Test@Post.se",
      passwordHash: "hash",
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/); // gen_random_uuid()
    expect(created.email).toBe("test@post.se"); // normaliserad
    expect(created.role).toBe("user");

    const found = await usersRepository.findUserByEmail("test@post.se");
    expect(found?.id).toBe(created.id);
  });
});

describe("questionsRepository mot PGlite", () => {
  it("lagrar options som jsonb-array och uppdaterar updated_at via trigger", async () => {
    const created = await questionsRepository.create({
      question: "Sveriges huvudstad?",
      answer: "Stockholm",
      options: ["Stockholm", "Oslo"],
      category: "Geografi",
      type: "multiple_choice",
    });

    expect(created.options).toEqual(["Stockholm", "Oslo"]);
    expect(created.createdAt.getTime()).toBe(created.updatedAt.getTime());

    // Vänta så att klockan hinner ticka, uppdatera och verifiera triggern.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const updated = await questionsRepository.update(created.id, {
      question: "Norges huvudstad?",
      answer: "Oslo",
      options: ["Oslo", "Bergen"],
      category: "Geografi",
      type: "multiple_choice",
    });

    expect(updated?.question).toBe("Norges huvudstad?");
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(
      updated!.createdAt.getTime(),
    );

    expect(await questionsRepository.remove(created.id)).toBe(true);
    expect(await questionsRepository.remove(created.id)).toBe(false);
  });
});

describe("DbSessionStore mot PGlite", () => {
  it("set → get → destroy fungerar", async () => {
    const store = new DbSessionStore(db);
    const get = promisify(store.get.bind(store)) as (
      sid: string,
    ) => Promise<SessionData | null | undefined>;
    const set = promisify(store.set.bind(store)) as (
      sid: string,
      s: SessionData,
    ) => Promise<void>;
    const destroy = promisify(store.destroy.bind(store)) as (
      sid: string,
    ) => Promise<void>;

    const sess = {
      cookie: { originalMaxAge: 1000, expires: new Date(Date.now() + 60_000) },
      userId: "id-1",
      role: "admin",
    } as unknown as SessionData;

    await set("sid-1", sess);
    const loaded = await get("sid-1");
    expect((loaded as unknown as { userId: string })?.userId).toBe("id-1");

    await destroy("sid-1");
    expect(await get("sid-1")).toBeNull();
  });
});
