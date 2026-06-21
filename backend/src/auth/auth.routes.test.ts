import { describe, it, expect, vi } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { createAuthRouter, type AuthRouterDeps } from "./auth.routes";
import { EmailAlreadyInUseError } from "./auth.service";
import type { User } from "../users/users.types";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "id-1",
    email: "kalle@post.se",
    passwordHash: "hash",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function makeApp(deps: Partial<AuthRouterDeps>) {
  const app = express();
  app.use(express.json());
  app.use(
    session({ secret: "test", resave: false, saveUninitialized: false }),
  );
  app.use(
    "/auth",
    createAuthRouter({
      registerUser: deps.registerUser ?? vi.fn(),
      loginUser: deps.loginUser ?? vi.fn(),
      findUserById: deps.findUserById ?? vi.fn(),
    }),
  );
  return app;
}

describe("POST /auth/register", () => {
  it("skapar en användare och svarar 201", async () => {
    const registerUser = vi.fn().mockResolvedValue(makeUser());
    const app = makeApp({ registerUser });

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "kalle@post.se", password: "hemligt123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "kalle@post.se", role: "user" });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("svarar 409 om e-posten redan finns", async () => {
    const registerUser = vi.fn().mockRejectedValue(new EmailAlreadyInUseError());
    const app = makeApp({ registerUser });

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "kalle@post.se", password: "hemligt123" });

    expect(res.status).toBe(409);
  });

  it("svarar 400 vid ogiltig e-post eller för kort lösenord", async () => {
    const app = makeApp({});

    const badEmail = await request(app)
      .post("/auth/register")
      .send({ email: "inte-epost", password: "hemligt123" });
    const shortPw = await request(app)
      .post("/auth/register")
      .send({ email: "kalle@post.se", password: "kort" });

    expect(badEmail.status).toBe(400);
    expect(shortPw.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("loggar in och sätter en sessions-cookie", async () => {
    const loginUser = vi.fn().mockResolvedValue(makeUser({ role: "admin" }));
    const app = makeApp({ loginUser });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "kalle@post.se", password: "hemligt123" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: "admin" });
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("svarar 401 vid fel uppgifter", async () => {
    const loginUser = vi.fn().mockResolvedValue(null);
    const app = makeApp({ loginUser });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "kalle@post.se", password: "fel" });

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("svarar 204", async () => {
    const app = makeApp({});

    const res = await request(app).post("/auth/logout");

    expect(res.status).toBe(204);
  });
});

describe("GET /auth/me", () => {
  it("svarar 401 när ingen är inloggad", async () => {
    const res = await request(makeApp({})).get("/auth/me");

    expect(res.status).toBe(401);
  });

  it("returnerar inloggad användare efter login", async () => {
    const user = makeUser({ role: "admin" });
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(user),
      findUserById: vi.fn().mockResolvedValue(user),
    });
    const agent = request.agent(app);

    await agent
      .post("/auth/login")
      .send({ email: "kalle@post.se", password: "hemligt123" });
    const res = await agent.get("/auth/me");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "kalle@post.se", role: "admin" });
  });
});
