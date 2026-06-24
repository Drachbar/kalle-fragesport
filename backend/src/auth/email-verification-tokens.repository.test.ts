import { describe, expect, it } from "vitest";
import {
  createEmailVerificationTokensRepository,
  InvalidEmailVerificationTokenError,
} from "./email-verification-tokens.repository";
import type { Database, QueryResult } from "../db";

class FakeDatabase implements Database {
  rowCount = 0;
  queries: string[] = [];

  async query<T = Record<string, unknown>>(
    text: string,
    _params?: unknown[],
  ): Promise<QueryResult<T>> {
    this.queries.push(text);
    return { rows: [], rowCount: this.rowCount };
  }

  async exec(): Promise<void> {
    return undefined;
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  async close(): Promise<void> {
    return undefined;
  }
}

describe("emailVerificationTokensRepository", () => {
  it("accepterar en token som redan använts för ett verifierat konto", async () => {
    const database = new FakeDatabase();
    database.rowCount = 1;
    const repo = createEmailVerificationTokensRepository(database);

    await expect(repo.verifyToken("token-123")).resolves.toBeUndefined();

    expect(database.queries[0]).toContain("email_verified_at IS NOT NULL");
  });

  it("kastar när token saknas eller inte längre är giltig", async () => {
    const database = new FakeDatabase();
    const repo = createEmailVerificationTokensRepository(database);

    await expect(repo.verifyToken("token-123")).rejects.toBeInstanceOf(
      InvalidEmailVerificationTokenError,
    );
  });
});
