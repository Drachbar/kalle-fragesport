import { Router } from "express";
import { requireAdmin } from "../auth/middleware";
import {
  questionsRepository,
  type QuestionsRepository,
} from "./questions.repository";
import {
  createQuestionSchema,
  updateQuestionSchema,
} from "./questions.validation";

export function createQuestionsRouter(
  repo: QuestionsRepository = questionsRepository,
): Router {
  const router = Router();

  // Publik läsning.
  router.get("/", async (_req, res) => {
    res.json(await repo.list());
  });

  router.get("/:id", async (req, res) => {
    const question = await repo.getById(req.params.id);
    if (!question) {
      res.status(404).json({ error: "Frågan hittades inte" });
      return;
    }
    res.json(question);
  });

  // Skrivoperationer kräver admin.
  router.post("/", requireAdmin, async (req, res) => {
    const parsed = createQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltig fråga" });
      return;
    }
    const created = await repo.create(parsed.data);
    res.status(201).json(created);
  });

  router.put("/:id", requireAdmin, async (req, res) => {
    const parsed = updateQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ogiltig fråga" });
      return;
    }
    const updated = await repo.update(String(req.params.id), parsed.data);
    if (!updated) {
      res.status(404).json({ error: "Frågan hittades inte" });
      return;
    }
    res.json(updated);
  });

  router.delete("/:id", requireAdmin, async (req, res) => {
    const removed = await repo.remove(String(req.params.id));
    if (!removed) {
      res.status(404).json({ error: "Frågan hittades inte" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
