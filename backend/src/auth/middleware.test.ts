import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, requireAdmin } from "./middleware";
import type { Role } from "../users/users.types";

function makeReq(session: { userId?: string; role?: Role }): Request {
  return { session } as unknown as Request;
}

function makeRes(): Response & { statusCode?: number; body?: unknown } {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response["status"];
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as Response["json"];
  return res;
}

describe("requireAuth", () => {
  it("svarar 401 och kallar inte next när userId saknas", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(makeReq({}), res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("kallar next när userId finns", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(makeReq({ userId: "id-1", role: "user" }), res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe("requireAdmin", () => {
  it("svarar 401 när userId saknas", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(makeReq({}), res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("svarar 403 när användaren inte är admin", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(makeReq({ userId: "id-1", role: "user" }), res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("kallar next när användaren är admin", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(makeReq({ userId: "id-1", role: "admin" }), res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
