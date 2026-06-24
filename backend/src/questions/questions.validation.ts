import { z } from "zod";

export const questionTypeSchema = z.enum([
  "multiple_choice",
  "free_text",
  "true_false",
]);

export const createQuestionSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  options: z.array(z.string()).default([]),
  category: z.string().min(1).nullish().transform((v) => v ?? null),
  type: questionTypeSchema.default("multiple_choice"),
  autoUpdate: z.boolean().default(false),
  updateIntervalDays: z.number().int().min(1).default(30),
});

// PUT ersätter hela frågan – samma form som vid skapande.
export const updateQuestionSchema = createQuestionSchema;

export type CreateQuestionBody = z.infer<typeof createQuestionSchema>;
