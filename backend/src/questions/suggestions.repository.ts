import { getDatabase } from "../db";
import type { ResearchSource } from "../ai/answer-researcher";

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface AnswerSuggestion {
  id: string;
  questionId: string;
  jobId: string | null;
  previousAnswer: string;
  suggestedAnswer: string;
  previousOptions: string[];
  suggestedOptions: string[];
  sources: ResearchSource[];
  reasoning: string | null;
  confidence: number | null;
  /** AI:ns rekommenderade kontrollintervall (dagar); null om inget föreslogs. */
  suggestedIntervalDays: number | null;
  /** AI:ns föreslagna tidigast-datum (ISO); null om inget. */
  suggestedEarliestUpdateAt: string | null;
  /** Datum det föreslagna svaret gäller per (ISO); null om okänt. */
  answerAsOf: string | null;
  /** True om AI:ns källa är äldre än frågans nuvarande svar. */
  olderThanCurrent: boolean;
  status: SuggestionStatus;
  createdAt: Date;
}

/** Ett väntande förslag berikat med frågans text för granskningsvyn. */
export interface PendingSuggestion extends AnswerSuggestion {
  question: string;
}

export interface SuggestionInput {
  questionId: string;
  jobId: string | null;
  previousAnswer: string;
  suggestedAnswer: string;
  previousOptions: string[];
  suggestedOptions: string[];
  sources: ResearchSource[];
  reasoning: string | null;
  confidence: number | null;
  suggestedIntervalDays: number | null;
  suggestedEarliestUpdateAt: string | null;
  answerAsOf: string | null;
  olderThanCurrent: boolean;
}

interface SuggestionRow {
  id: string;
  question_id: string;
  job_id: string | null;
  previous_answer: string;
  suggested_answer: string;
  previous_options: string[];
  suggested_options: string[];
  sources: unknown;
  reasoning: string | null;
  confidence: number | null;
  suggested_interval_days: number | null;
  suggested_earliest_update_at: Date | null;
  answer_as_of: Date | null;
  older_than_current: boolean;
  status: SuggestionStatus;
  created_at: Date;
}

const SELECT_COLUMNS =
  "id, question_id, job_id, previous_answer, suggested_answer, previous_options, suggested_options, sources, reasoning, confidence, suggested_interval_days, suggested_earliest_update_at, answer_as_of, older_than_current, status, created_at";

/** Normaliserar lagrade källor (äldre rader kan vara string[]) till objektform. */
function normalizeSources(raw: unknown): ResearchSource[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) =>
    typeof item === "string"
      ? { url: item, publishedAt: null }
      : {
          url: String((item as ResearchSource).url ?? ""),
          publishedAt: (item as ResearchSource).publishedAt ?? null,
        },
  );
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function mapRow(row: SuggestionRow): AnswerSuggestion {
  return {
    id: row.id,
    questionId: row.question_id,
    jobId: row.job_id,
    previousAnswer: row.previous_answer,
    suggestedAnswer: row.suggested_answer,
    previousOptions: row.previous_options,
    suggestedOptions: row.suggested_options,
    // jsonb returneras redan som parsad array av pg.
    sources: normalizeSources(row.sources),
    reasoning: row.reasoning,
    confidence: row.confidence,
    suggestedIntervalDays: row.suggested_interval_days,
    suggestedEarliestUpdateAt: toIso(row.suggested_earliest_update_at),
    answerAsOf: toIso(row.answer_as_of),
    olderThanCurrent: row.older_than_current,
    status: row.status,
    createdAt: row.created_at,
  };
}

export interface SuggestionsRepository {
  create(input: SuggestionInput): Promise<AnswerSuggestion>;
  listPending(): Promise<PendingSuggestion[]>;
  getById(id: string): Promise<AnswerSuggestion | null>;
  setStatus(
    id: string,
    status: SuggestionStatus,
  ): Promise<AnswerSuggestion | null>;
}

export const suggestionsRepository: SuggestionsRepository = {
  async create({
    questionId,
    jobId,
    previousAnswer,
    suggestedAnswer,
    previousOptions,
    suggestedOptions,
    sources,
    reasoning,
    confidence,
    suggestedIntervalDays,
    suggestedEarliestUpdateAt,
    answerAsOf,
    olderThanCurrent,
  }) {
    const result = await getDatabase().query<SuggestionRow>(
      `INSERT INTO answer_suggestions
         (question_id, job_id, previous_answer, suggested_answer,
          previous_options, suggested_options, sources, reasoning, confidence,
          suggested_interval_days, suggested_earliest_update_at, answer_as_of,
          older_than_current)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
       RETURNING ${SELECT_COLUMNS}`,
      [
        questionId,
        jobId,
        previousAnswer,
        suggestedAnswer,
        JSON.stringify(previousOptions),
        JSON.stringify(suggestedOptions),
        JSON.stringify(sources),
        reasoning,
        confidence,
        suggestedIntervalDays,
        suggestedEarliestUpdateAt,
        answerAsOf,
        olderThanCurrent,
      ],
    );
    return mapRow(result.rows[0]);
  },

  async listPending() {
    const result = await getDatabase().query<SuggestionRow & { question: string }>(
      `SELECT s.id, s.question_id, s.job_id, s.previous_answer, s.suggested_answer,
              s.previous_options, s.suggested_options, s.sources,
              s.reasoning, s.confidence, s.suggested_interval_days,
              s.suggested_earliest_update_at, s.answer_as_of, s.older_than_current,
              s.status, s.created_at,
              q.question
       FROM answer_suggestions s
       JOIN questions q ON q.id = s.question_id
       WHERE s.status = 'pending'
       ORDER BY s.created_at DESC`,
    );
    return result.rows.map((row) => ({
      ...mapRow(row),
      question: row.question,
    }));
  },

  async getById(id) {
    const result = await getDatabase().query<SuggestionRow>(
      `SELECT ${SELECT_COLUMNS} FROM answer_suggestions WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async setStatus(id, status) {
    const result = await getDatabase().query<SuggestionRow>(
      `UPDATE answer_suggestions
       SET status = $2
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, status],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },
};
