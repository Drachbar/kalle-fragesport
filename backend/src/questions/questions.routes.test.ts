import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createQuestionsRouter } from "./questions.routes";
import type { QuestionsRepository } from "./questions.repository";
import type { Question } from "./questions.types";
import type { Role } from "../users/users.types";

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    question: "Sveriges huvudstad?",
    answer: "Stockholm",
    options: ["Stockholm", "Oslo"],
    category: "Geografi",
    type: "multiple_choice",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function fakeRepo(over: Partial<QuestionsRepository> = {}): QuestionsRepository {
  return {
    list: vi.fn().mockResolvedValue([makeQuestion()]),
    getById: vi.fn().mockResolvedValue(makeQuestion()),
    create: vi.fn().mockResolvedValue(makeQuestion()),
    update: vi.fn().mockResolvedValue(makeQuestion()),
    remove: vi.fn().mockResolvedValue(true),
    ...over,
  };
}

// Injicerar en fejkad session så vi slipper hela inloggningsflödet.
function makeApp(
  repo: QuestionsRepository,
  session: { userId?: string; role?: Role } = {},
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: unknown }).session = session;
    next();
  });
  app.use("/questions", createQuestionsRouter(repo));
  return app;
}

const adminSession = { userId: "id-1", role: "admin" as Role };
const userSession = { userId: "id-2", role: "user" as Role };
const validBody = { question: "Fråga?", answer: "Svar", options: ["a", "b"] };

describe("GET /questions (publikt)", () => {
  it("returnerar listan utan inloggning", async () => {
    const app = makeApp(fakeRepo());
    const res = await request(app).get("/questions");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("svarar 404 för okänt id", async () => {
    const app = makeApp(fakeRepo({ getById: vi.fn().mockResolvedValue(null) }));
    const res = await request(app).get("/questions/saknas");

    expect(res.status).toBe(404);
  });
});

describe("POST /questions (admin)", () => {
  it("skapar en fråga som admin → 201", async () => {
    const repo = fakeRepo();
    const res = await request(makeApp(repo, adminSession))
      .post("/questions")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("svarar 403 för inloggad icke-admin", async () => {
    const repo = fakeRepo();
    const res = await request(makeApp(repo, userSession))
      .post("/questions")
      .send(validBody);

    expect(res.status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("svarar 401 för oinloggad", async () => {
    const res = await request(makeApp(fakeRepo()))
      .post("/questions")
      .send(validBody);

    expect(res.status).toBe(401);
  });

  it("svarar 400 vid ogiltig body (admin)", async () => {
    const res = await request(makeApp(fakeRepo(), adminSession))
      .post("/questions")
      .send({ question: "", answer: "" });

    expect(res.status).toBe(400);
  });
});

describe("PUT /questions/:id (admin)", () => {
  it("uppdaterar som admin → 200", async () => {
    const res = await request(makeApp(fakeRepo(), adminSession))
      .put("/questions/q-1")
      .send(validBody);

    expect(res.status).toBe(200);
  });

  it("svarar 404 om frågan saknas", async () => {
    const repo = fakeRepo({ update: vi.fn().mockResolvedValue(null) });
    const res = await request(makeApp(repo, adminSession))
      .put("/questions/saknas")
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(fakeRepo(), userSession))
      .put("/questions/q-1")
      .send(validBody);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /questions/:id (admin)", () => {
  it("raderar som admin → 204", async () => {
    const res = await request(makeApp(fakeRepo(), adminSession)).delete(
      "/questions/q-1",
    );

    expect(res.status).toBe(204);
  });

  it("svarar 404 om frågan saknas", async () => {
    const repo = fakeRepo({ remove: vi.fn().mockResolvedValue(false) });
    const res = await request(makeApp(repo, adminSession)).delete(
      "/questions/saknas",
    );

    expect(res.status).toBe(404);
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(fakeRepo(), userSession)).delete(
      "/questions/q-1",
    );

    expect(res.status).toBe(403);
  });
});
