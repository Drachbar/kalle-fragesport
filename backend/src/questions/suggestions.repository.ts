import { getDatabase } from "../db";

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface AnswerSuggestion {
  id: string;
  questionId: string;
  jobId: string | null;
  previousAnswer: string;
  suggestedAnswer: string;
  sources: string[];
  reasoning: string | null;
  confidence: number | null;
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
  sources: string[];
  reasoning: string | null;
  confidence: number | null;
}

interface SuggestionRow {
  id: string;
  question_id: string;
  job_id: string | null;
  previous_answer: string;
  suggested_answer: string;
  sources: string[];
  reasoning: string | null;
  confidence: number | null;
  status: SuggestionStatus;
  created_at: Date;
}

const SELECT_COLUMNS =
  "id, question_id, job_id, previous_answer, suggested_answer, sources, reasoning, confidence, status, created_at";

function mapRow(row: SuggestionRow): AnswerSuggestion {
  return {
    id: row.id,
    questionId: row.question_id,
    jobId: row.job_id,
    previousAnswer: row.previous_answer,
    suggestedAnswer: row.suggested_answer,
    // jsonb returneras redan som parsad array av pg.
    sources: row.sources,
    reasoning: row.reasoning,
    confidence: row.confidence,
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
    sources,
    reasoning,
    confidence,
  }) {
    const result = await getDatabase().query<SuggestionRow>(
      `INSERT INTO answer_suggestions
         (question_id, job_id, previous_answer, suggested_answer, sources, reasoning, confidence)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING ${SELECT_COLUMNS}`,
      [
        questionId,
        jobId,
        previousAnswer,
        suggestedAnswer,
        JSON.stringify(sources),
        reasoning,
        confidence,
      ],
    );
    return mapRow(result.rows[0]);
  },

  async listPending() {
    const result = await getDatabase().query<SuggestionRow & { question: string }>(
      `SELECT s.id, s.question_id, s.job_id, s.previous_answer, s.suggested_answer,
              s.sources, s.reasoning, s.confidence, s.status, s.created_at,
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
