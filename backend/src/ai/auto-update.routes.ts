import { Router } from "express";
import { z } from "zod";
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
import { createResearcherFromKey } from "./openai-client";
import { runAutoUpdateJob } from "./answer-update.service";
import { openAiKeysRepository } from "../users/openai-keys.repository";
import { decryptSecret } from "../security/crypto";
import { createLogger } from "../logging/logger";

const log = createLogger("ai:auto-update");

export interface AutoUpdateRouterDeps {
  questionsRepo: Pick<
    QuestionsRepository,
    | "getById"
    | "update"
    | "listAutoUpdate"
    | "listDueForAutoUpdate"
    | "markChecked"
    | "updateTiming"
  >;
  jobsRepo: Pick<
    JobsRepository,
    "create" | "getById" | "hasActive" | "update"
  >;
  suggestionsRepo: Pick<
    SuggestionsRepository,
    "create" | "listPending" | "getById" | "setStatus"
  >;
  /**
   * Slår upp vilken OpenAI-nyckel som ska användas. Env-nyckel först (delad);
   * saknas den används den inloggade adminens egna sparade nyckel.
   * Returnerar null om ingen nyckel finns.
   */
  resolveApiKey: (userId: string) => Promise<string | null>;
  createResearcher: (apiKey: string) => AnswerResearcher;
  runJob: typeof runAutoUpdateJob;
}

/** Standard nyckel-resolution: env-nyckel först, annars användarens egna. */
async function resolveApiKeyFromEnvOrUser(
  userId: string,
): Promise<string | null> {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    log.debug("Använder OpenAI-nyckel från miljön", { userId });
    return envKey;
  }
  const encrypted = await openAiKeysRepository.getEncryptedKey(userId);
  if (encrypted) {
    log.debug("Använder adminens egna sparade OpenAI-nyckel", { userId });
    return decryptSecret(encrypted);
  }
  log.warn("Ingen OpenAI-nyckel hittades (varken env eller egen)", { userId });
  return null;
}

const defaultDeps: AutoUpdateRouterDeps = {
  questionsRepo: questionsRepository,
  jobsRepo: jobsRepository,
  suggestionsRepo: suggestionsRepository,
  resolveApiKey: resolveApiKeyFromEnvOrUser,
  createResearcher: (apiKey) => createResearcherFromKey(apiKey),
  runJob: runAutoUpdateJob,
};

export function createAutoUpdateRouter(
  deps: AutoUpdateRouterDeps = defaultDeps,
): Router {
  const {
    questionsRepo,
    jobsRepo,
    suggestionsRepo,
    resolveApiKey,
    createResearcher,
    runJob,
  } = deps;
  const router = Router();

  // Valfritt: begränsa jobbet till en specifik fråga, och välj läge.
  const startSchema = z.object({
    questionId: z.string().min(1).optional(),
    mode: z.enum(["answer", "interval"]).default("answer"),
  });

  // Starta ett bakgrundsjobb. Utan questionId körs alla tidskänsliga frågor;
  // med questionId uppdateras enbart den valda frågan. mode "interval" uppdaterar
  // bara kontrollintervallet (skapar inga svarsförslag).
  router.post("/auto-update", requireAdmin, async (req, res) => {
    const userId = req.session.userId as string;
    const parsed = startSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      log.warn("Avvisar auto-update: ogiltig body", { userId });
      res.status(400).json({ error: "Ogiltig fråga" });
      return;
    }
    log.info("Begäran om auto-uppdatering", {
      userId,
      questionId: parsed.data.questionId,
      mode: parsed.data.mode,
    });

    if (await jobsRepo.hasActive()) {
      log.info("Avvisar auto-update: ett jobb kör redan", { userId });
      res.status(409).json({ error: "Ett jobb kör redan" });
      return;
    }

    // Lös upp nyckeln (env först, annars adminens egna) och skapa researchern.
    // Misslyckas något (saknad/ogiltig nyckel) skapar vi inget jobb.
    let researcher: AnswerResearcher;
    try {
      const apiKey = await resolveApiKey(userId);
      if (!apiKey) {
        res.status(503).json({
          error:
            "Ingen OpenAI-nyckel konfigurerad – ange en egen under Inställningar",
        });
        return;
      }
      researcher = createResearcher(apiKey);
    } catch (err) {
      log.error("Kunde inte skapa AI-researcher", { userId, err });
      res.status(503).json({
        error: err instanceof Error ? err.message : "AI ej tillgänglig",
      });
      return;
    }

    const job = await jobsRepo.create();
    log.info("Jobb skapat, kör i bakgrunden", {
      userId,
      jobId: job.id,
      questionId: parsed.data.questionId,
    });
    // Kör i bakgrunden – vi väntar inte in resultatet.
    void runJob(job.id, {
      questionsRepo,
      suggestionsRepo,
      jobsRepo,
      researcher,
      questionId: parsed.data.questionId,
      mode: parsed.data.mode,
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
      options: suggestion.suggestedOptions,
      category: question.category,
      type: question.type,
      autoUpdate: question.autoUpdate,
      // Applicera AI:ns rekommenderade intervall/datum om de föreslogs.
      updateIntervalDays:
        suggestion.suggestedIntervalDays ?? question.updateIntervalDays,
      earliestUpdateAt:
        suggestion.suggestedEarliestUpdateAt ??
        question.earliestUpdateAt?.toISOString() ??
        null,
      // Det godkända svaret gäller per AI:ns angivna datum.
      answerAsOf:
        suggestion.answerAsOf ?? question.answerAsOf?.toISOString() ?? null,
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
