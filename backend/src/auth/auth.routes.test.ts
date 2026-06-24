import { describe, it, expect, vi } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { createAuthRouter, type AuthRouterDeps } from "./auth.routes";
import { EmailAlreadyInUseError, InvalidPasswordError } from "./auth.service";
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
      changePassword: deps.changePassword ?? vi.fn(),
      deleteAccount: deps.deleteAccount ?? vi.fn(),
      destroyUserSessions: deps.destroyUserSessions ?? vi.fn(),
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

/** Loggar in en agent så att efterföljande anrop har en giltig session. */
async function loginAgent(app: ReturnType<typeof makeApp>) {
  const agent = request.agent(app);
  await agent
    .post("/auth/login")
    .send({ email: "kalle@post.se", password: "hemligt123" });
  return agent;
}

describe("PUT /auth/me/password", () => {
  it("svarar 401 när ingen är inloggad", async () => {
    const res = await request(makeApp({}))
      .put("/auth/me/password")
      .send({ currentPassword: "nuvarande123", newPassword: "nyttlosen456" });

    expect(res.status).toBe(401);
  });

  it("byter lösenord och loggar ut övriga sessioner → 204", async () => {
    const changePassword = vi.fn().mockResolvedValue(undefined);
    const destroyUserSessions = vi.fn().mockResolvedValue(undefined);
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(makeUser()),
      findUserById: vi.fn().mockResolvedValue(makeUser()),
      changePassword,
      destroyUserSessions,
    });
    const agent = await loginAgent(app);

    const res = await agent
      .put("/auth/me/password")
      .send({ currentPassword: "nuvarande123", newPassword: "nyttlosen456" });

    expect(res.status).toBe(204);
    expect(changePassword).toHaveBeenCalledWith(
      "id-1",
      "nuvarande123",
      "nyttlosen456",
    );
    // Övriga sessioner ska rensas, men den nuvarande (exceptSid) behållas.
    expect(destroyUserSessions).toHaveBeenCalledWith("id-1", expect.any(String));

    // Den nuvarande sessionen ska fortfarande vara giltig.
    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
  });

  it("svarar 403 vid fel nuvarande lösenord", async () => {
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(makeUser()),
      changePassword: vi.fn().mockRejectedValue(new InvalidPasswordError()),
    });
    const agent = await loginAgent(app);

    const res = await agent
      .put("/auth/me/password")
      .send({ currentPassword: "fel", newPassword: "nyttlosen456" });

    expect(res.status).toBe(403);
  });

  it("svarar 400 när nytt lösenord är för kort", async () => {
    const changePassword = vi.fn();
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(makeUser()),
      changePassword,
    });
    const agent = await loginAgent(app);

    const res = await agent
      .put("/auth/me/password")
      .send({ currentPassword: "nuvarande123", newPassword: "kort" });

    expect(res.status).toBe(400);
    expect(changePassword).not.toHaveBeenCalled();
  });
});

describe("DELETE /auth/me", () => {
  it("svarar 401 när ingen är inloggad", async () => {
    const res = await request(makeApp({}))
      .delete("/auth/me")
      .send({ password: "nuvarande123" });

    expect(res.status).toBe(401);
  });

  it("raderar kontot och loggar ut → 204", async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(makeUser()),
      findUserById: vi.fn().mockResolvedValue(makeUser()),
      deleteAccount,
    });
    const agent = await loginAgent(app);

    const res = await agent.delete("/auth/me").send({ password: "nuvarande123" });

    expect(res.status).toBe(204);
    expect(deleteAccount).toHaveBeenCalledWith("id-1", "nuvarande123");

    // Sessionen ska vara borta efteråt.
    const after = await agent.get("/auth/me");
    expect(after.status).toBe(401);
  });

  it("svarar 403 vid fel lösenord", async () => {
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(makeUser()),
      deleteAccount: vi.fn().mockRejectedValue(new InvalidPasswordError()),
    });
    const agent = await loginAgent(app);

    const res = await agent.delete("/auth/me").send({ password: "fel" });

    expect(res.status).toBe(403);
  });
});

describe("POST /auth/logout-all", () => {
  it("svarar 401 när ingen är inloggad", async () => {
    const res = await request(makeApp({})).post("/auth/logout-all");

    expect(res.status).toBe(401);
  });

  it("loggar ut alla sessioner inklusive den nuvarande → 204", async () => {
    const destroyUserSessions = vi.fn().mockResolvedValue(undefined);
    const app = makeApp({
      loginUser: vi.fn().mockResolvedValue(makeUser()),
      findUserById: vi.fn().mockResolvedValue(makeUser()),
      destroyUserSessions,
    });
    const agent = await loginAgent(app);

    const res = await agent.post("/auth/logout-all");

    expect(res.status).toBe(204);
    expect(destroyUserSessions).toHaveBeenCalledWith("id-1", expect.any(String));

    // Den nuvarande sessionen ska också vara borta.
    const me = await agent.get("/auth/me");
    expect(me.status).toBe(401);
  });
});
