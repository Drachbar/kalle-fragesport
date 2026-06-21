import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createAutoUpdateRouter, type AutoUpdateRouterDeps } from "./auto-update.routes";
import type { Role } from "../users/users.types";
import type { Question } from "../questions/questions.types";
import type { AnswerSuggestion } from "../questions/suggestions.repository";
import type { AutoUpdateJob } from "../questions/jobs.repository";

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    question: "Hur många mål?",
    answer: "7",
    options: [],
    category: "Sport",
    type: "free_text",
    autoUpdate: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function makeJob(over: Partial<AutoUpdateJob> = {}): AutoUpdateJob {
  return {
    id: "job-1",
    status: "running",
    total: 3,
    processed: 1,
    suggestionsCreated: 0,
    error: null,
    createdAt: new Date(),
    finishedAt: null,
    ...over,
  };
}

function makeSuggestion(over: Partial<AnswerSuggestion> = {}): AnswerSuggestion {
  return {
    id: "s-1",
    questionId: "q-1",
    jobId: "job-1",
    previousAnswer: "7",
    suggestedAnswer: "8",
    sources: ["https://example.com"],
    reasoning: "Ett mål till.",
    confidence: 0.9,
    status: "pending",
    createdAt: new Date(),
    ...over,
  };
}

function makeDeps(over: Partial<AutoUpdateRouterDeps> = {}): AutoUpdateRouterDeps {
  return {
    questionsRepo: {
      listAutoUpdate: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(makeQuestion()),
      update: vi.fn().mockResolvedValue(makeQuestion()),
    },
    jobsRepo: {
      create: vi.fn().mockResolvedValue(makeJob({ status: "pending" })),
      getById: vi.fn().mockResolvedValue(makeJob()),
      hasActive: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockResolvedValue(makeJob()),
    },
    suggestionsRepo: {
      create: vi.fn().mockResolvedValue(makeSuggestion()),
      listPending: vi.fn().mockResolvedValue([{ ...makeSuggestion(), question: "Hur många mål?" }]),
      getById: vi.fn().mockResolvedValue(makeSuggestion()),
      setStatus: vi.fn().mockResolvedValue(makeSuggestion({ status: "approved" })),
    },
    createResearcher: vi.fn().mockReturnValue({ research: vi.fn() }),
    runJob: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function makeApp(deps: AutoUpdateRouterDeps, session: { userId?: string; role?: Role } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: unknown }).session = session;
    next();
  });
  app.use("/questions", createAutoUpdateRouter(deps));
  return app;
}

const adminSession = { userId: "id-1", role: "admin" as Role };
const userSession = { userId: "id-2", role: "user" as Role };

describe("POST /questions/auto-update (admin)", () => {
  it("startar ett jobb och returnerar 201 med jobId", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession)).post("/questions/auto-update");

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBe("job-1");
    expect(deps.jobsRepo.create).toHaveBeenCalledOnce();
    expect(deps.runJob).toHaveBeenCalledOnce();
    expect(deps.runJob).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        questionsRepo: deps.questionsRepo,
        jobsRepo: deps.jobsRepo,
        suggestionsRepo: deps.suggestionsRepo,
      }),
    );
  });

  it("svarar 409 om ett jobb redan kör", async () => {
    const deps = makeDeps({
      jobsRepo: {
        create: vi.fn(),
        getById: vi.fn(),
        hasActive: vi.fn().mockResolvedValue(true),
        update: vi.fn(),
      },
    });
    const res = await request(makeApp(deps, adminSession)).post("/questions/auto-update");

    expect(res.status).toBe(409);
    expect(deps.jobsRepo.create).not.toHaveBeenCalled();
  });

  it("svarar 503 om researchern inte kan skapas (saknar API-nyckel)", async () => {
    const deps = makeDeps({
      createResearcher: vi.fn(() => {
        throw new Error("OPENAI_API_KEY måste sättas");
      }),
    });
    const res = await request(makeApp(deps, adminSession)).post("/questions/auto-update");

    expect(res.status).toBe(503);
    expect(deps.jobsRepo.create).not.toHaveBeenCalled();
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(makeDeps(), userSession)).post("/questions/auto-update");
    expect(res.status).toBe(403);
  });

  it("svarar 401 för oinloggad", async () => {
    const res = await request(makeApp(makeDeps())).post("/questions/auto-update");
    expect(res.status).toBe(401);
  });
});

describe("GET /questions/auto-update/:jobId (admin)", () => {
  it("returnerar jobbstatus", async () => {
    const res = await request(makeApp(makeDeps(), adminSession)).get(
      "/questions/auto-update/job-1",
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "running",
      total: 3,
      processed: 1,
      suggestionsCreated: 0,
    });
  });

  it("svarar 404 för okänt jobb", async () => {
    const deps = makeDeps({
      jobsRepo: {
        create: vi.fn(),
        getById: vi.fn().mockResolvedValue(null),
        hasActive: vi.fn(),
        update: vi.fn(),
      },
    });
    const res = await request(makeApp(deps, adminSession)).get("/questions/auto-update/saknas");
    expect(res.status).toBe(404);
  });
});

describe("GET /questions/suggestions (admin)", () => {
  it("listar väntande förslag", async () => {
    const res = await request(makeApp(makeDeps(), adminSession)).get("/questions/suggestions");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].question).toBe("Hur många mål?");
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(makeDeps(), userSession)).get("/questions/suggestions");
    expect(res.status).toBe(403);
  });
});

describe("POST /questions/suggestions/:id/approve (admin)", () => {
  it("uppdaterar frågans svar och markerar förslaget approved", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession)).post(
      "/questions/suggestions/s-1/approve",
    );

    expect(res.status).toBe(200);
    expect(deps.questionsRepo.update).toHaveBeenCalledWith(
      "q-1",
      expect.objectContaining({ answer: "8" }),
    );
    expect(deps.suggestionsRepo.setStatus).toHaveBeenCalledWith("s-1", "approved");
  });

  it("svarar 404 om förslaget saknas", async () => {
    const deps = makeDeps({
      suggestionsRepo: {
        create: vi.fn(),
        listPending: vi.fn(),
        getById: vi.fn().mockResolvedValue(null),
        setStatus: vi.fn(),
      },
    });
    const res = await request(makeApp(deps, adminSession)).post(
      "/questions/suggestions/saknas/approve",
    );

    expect(res.status).toBe(404);
    expect(deps.questionsRepo.update).not.toHaveBeenCalled();
  });

  it("svarar 409 om förslaget redan är hanterat", async () => {
    const deps = makeDeps({
      suggestionsRepo: {
        create: vi.fn(),
        listPending: vi.fn(),
        getById: vi.fn().mockResolvedValue(makeSuggestion({ status: "approved" })),
        setStatus: vi.fn(),
      },
    });
    const res = await request(makeApp(deps, adminSession)).post(
      "/questions/suggestions/s-1/approve",
    );

    expect(res.status).toBe(409);
    expect(deps.questionsRepo.update).not.toHaveBeenCalled();
  });
});

describe("POST /questions/suggestions/:id/reject (admin)", () => {
  it("markerar förslaget rejected utan att röra frågan", async () => {
    const deps = makeDeps();
    const res = await request(makeApp(deps, adminSession)).post(
      "/questions/suggestions/s-1/reject",
    );

    expect(res.status).toBe(200);
    expect(deps.suggestionsRepo.setStatus).toHaveBeenCalledWith("s-1", "rejected");
    expect(deps.questionsRepo.update).not.toHaveBeenCalled();
  });

  it("svarar 403 för icke-admin", async () => {
    const res = await request(makeApp(makeDeps(), userSession)).post(
      "/questions/suggestions/s-1/reject",
    );
    expect(res.status).toBe(403);
  });
});
