import { Router } from "express";
import { requireAdmin } from "../auth/middleware";
import {
  questionsRepository,
  type QuestionsRepository,
} from "../questions/questions.repository";
import {
  jobsRepository,
  type JobsRepository,
} from "../questions/jobs.repository";
import {
  suggestionsRepository,
  type SuggestionsRepository,
} from "../questions/suggestions.repository";
import type { QuestionInput } from "../questions/questions.types";
import type { AnswerResearcher } from "./answer-researcher";
import { createResearcherFromEnv } from "./openai-client";
import { runAutoUpdateJob } from "./answer-update.service";

export interface AutoUpdateRouterDeps {
  questionsRepo: Pick<
    QuestionsRepository,
    "getById" | "update" | "listAutoUpdate"
  >;
  jobsRepo: Pick<
    JobsRepository,
    "create" | "getById" | "hasActive" | "update"
  >;
  suggestionsRepo: Pick<
    SuggestionsRepository,
    "create" | "listPending" | "getById" | "setStatus"
  >;
  createResearcher: () => AnswerResearcher;
  runJob: typeof runAutoUpdateJob;
}

const defaultDeps: AutoUpdateRouterDeps = {
  questionsRepo: questionsRepository,
  jobsRepo: jobsRepository,
  suggestionsRepo: suggestionsRepository,
  createResearcher: () => createResearcherFromEnv(),
  runJob: runAutoUpdateJob,
};

export function createAutoUpdateRouter(
  deps: AutoUpdateRouterDeps = defaultDeps,
): Router {
  const { questionsRepo, jobsRepo, suggestionsRepo, createResearcher, runJob } =
    deps;
  const router = Router();

  // Starta ett bakgrundsjobb som går igenom tidskänsliga frågor.
  router.post("/auto-update", requireAdmin, async (_req, res) => {
    if (await jobsRepo.hasActive()) {
      res.status(409).json({ error: "Ett jobb kör redan" });
      return;
    }

    // Skapa researchern först – misslyckas den (t.ex. saknad nyckel) skapar
    // vi inget jobb.
    let researcher: AnswerResearcher;
    try {
      researcher = createResearcher();
    } catch (err) {
      res.status(503).json({
        error: err instanceof Error ? err.message : "AI ej tillgänglig",
      });
      return;
    }

    const job = await jobsRepo.create();
    // Kör i bakgrunden – vi väntar inte in resultatet.
    void runJob(job.id, {
      questionsRepo,
      suggestionsRepo,
      jobsRepo,
      researcher,
    });

    res.status(201).json({ jobId: job.id });
  });

  // Hämta status/progress för ett jobb (pollas av frontend).
  router.get("/auto-update/:jobId", requireAdmin, async (req, res) => {
    const job = await jobsRepo.getById(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ error: "Jobbet hittades inte" });
      return;
    }
    res.json({
      id: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      suggestionsCreated: job.suggestionsCreated,
      error: job.error,
    });
  });

  // Lista väntande förslag för granskning.
  router.get("/suggestions", requireAdmin, async (_req, res) => {
    res.json(await suggestionsRepo.listPending());
  });

  // Godkänn ett förslag: skriv in det nya svaret på frågan.
  router.post("/suggestions/:id/approve", requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const suggestion = await suggestionsRepo.getById(id);
    if (!suggestion) {
      res.status(404).json({ error: "Förslaget hittades inte" });
      return;
    }
    if (suggestion.status !== "pending") {
      res.status(409).json({ error: "Förslaget är redan hanterat" });
      return;
    }

    const question = await questionsRepo.getById(suggestion.questionId);
    if (!question) {
      res.status(404).json({ error: "Frågan hittades inte" });
      return;
    }

    const input: QuestionInput = {
      question: question.question,
      answer: suggestion.suggestedAnswer,
      options: question.options,
      category: question.category,
      type: question.type,
      autoUpdate: question.autoUpdate,
    };
    await questionsRepo.update(question.id, input);
    await suggestionsRepo.setStatus(id, "approved");

    res.json({ id, status: "approved" });
  });

  // Avvisa ett förslag: lämna frågan orörd.
  router.post("/suggestions/:id/reject", requireAdmin, async (req, res) => {
    const id = String(req.params.id);
    const suggestion = await suggestionsRepo.getById(id);
    if (!suggestion) {
      res.status(404).json({ error: "Förslaget hittades inte" });
      return;
    }
    if (suggestion.status !== "pending") {
      res.status(409).json({ error: "Förslaget är redan hanterat" });
      return;
    }

    await suggestionsRepo.setStatus(id, "rejected");
    res.json({ id, status: "rejected" });
  });

  return router;
}
