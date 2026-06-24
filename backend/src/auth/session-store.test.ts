import { describe, it, expect, vi } from "vitest";
import { DbSessionStore } from "./session-store";
import type { Database } from "../db";

function fakeDb() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as
    Database & { query: ReturnType<typeof vi.fn> };
}

describe("DbSessionStore.destroyAllForUser", () => {
  it("raderar alla sessioner för en användare", async () => {
    const db = fakeDb();
    await new DbSessionStore(db).destroyAllForUser("user-1");

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("DELETE FROM");
    expect(sql).toContain("sess->>'userId'");
    expect(sql).not.toContain("sid <>");
    expect(params).toEqual(["user-1"]);
  });

  it("behåller den nuvarande sessionen när exceptSid anges", async () => {
    const db = fakeDb();
    await new DbSessionStore(db).destroyAllForUser("user-1", "keep-sid");

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("sid <> $2");
    expect(params).toEqual(["user-1", "keep-sid"]);
  });
});
