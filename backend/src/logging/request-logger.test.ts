import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createRequestLogger } from "./request-logger";
import type { Logger } from "./logger";

function makeLogger(): Logger & {
  infoCalls: { message: string; context?: Record<string, unknown> }[];
} {
  const infoCalls: { message: string; context?: Record<string, unknown> }[] = [];
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn((message, context) => infoCalls.push({ message, context })),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  return Object.assign(logger, { infoCalls });
}

describe("createRequestLogger", () => {
  it("loggar metod, url och status när förfrågan är klar", async () => {
    const logger = makeLogger();
    const app = express();
    app.use(createRequestLogger(logger));
    app.get("/ping", (_req, res) => res.status(201).json({ ok: true }));

    await request(app).get("/ping");

    const done = logger.infoCalls.find((c) => c.message === "Förfrågan klar");
    expect(done?.context).toMatchObject({
      method: "GET",
      url: "/ping",
      status: 201,
    });
    expect(done?.context?.durationMs).toBeTypeOf("number");
  });
});
