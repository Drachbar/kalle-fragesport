import { getDatabase } from "../db";
import type { Question, QuestionInput, QuestionType } from "./questions.types";

interface QuestionRow {
  id: string;
  question: string;
  answer: string;
  options: string[];
  category: string | null;
  type: QuestionType;
  auto_update: boolean;
  update_interval_days: number;
  last_checked_at: Date | null;
  earliest_update_at: Date | null;
  answer_as_of: Date | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLUMNS =
  "id, question, answer, options, category, type, auto_update, update_interval_days, last_checked_at, earliest_update_at, answer_as_of, created_at, updated_at";

function mapRow(row: QuestionRow): Question {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    // jsonb returneras redan som parsad array av pg.
    options: row.options,
    category: row.category,
    type: row.type,
    autoUpdate: row.auto_update,
    updateIntervalDays: row.update_interval_days,
    lastCheckedAt: row.last_checked_at,
    earliestUpdateAt: row.earliest_update_at,
    answerAsOf: row.answer_as_of,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface QuestionsRepository {
  list(): Promise<Question[]>;
  listAutoUpdate(): Promise<Question[]>;
  /** Frågor markerade för auto-uppdatering vars kontrollintervall har löpt ut. */
  listDueForAutoUpdate(): Promise<Question[]>;
  getById(id: string): Promise<Question | null>;
  random(): Promise<Question | null>;
  create(input: QuestionInput): Promise<Question>;
  update(id: string, input: QuestionInput): Promise<Question | null>;
  /** Markerar att frågan precis kontrollerats av AI:n (sätter last_checked_at). */
  markChecked(id: string): Promise<void>;
  /** Uppdaterar bara tidsmetadata (intervall + tidigast-datum), inte svaret. */
  updateTiming(
    id: string,
    timing: { updateIntervalDays: number; earliestUpdateAt: string | null },
  ): Promise<void>;
  remove(id: string): Promise<boolean>;
}

export const questionsRepository: QuestionsRepository = {
  async list() {
    const result = await getDatabase().query<QuestionRow>(
      `SELECT ${SELECT_COLUMNS} FROM questions ORDER BY created_at DESC`,
    );
    return result.rows.map(mapRow);
  },

  async listAutoUpdate() {
    const result = await getDatabase().query<QuestionRow>(
      `SELECT ${SELECT_COLUMNS} FROM questions WHERE auto_update = true ORDER BY created_at DESC`,
    );
    return result.rows.map(mapRow);
  },

  async listDueForAutoUpdate() {
    const result = await getDatabase().query<QuestionRow>(
      `SELECT ${SELECT_COLUMNS} FROM questions
       WHERE auto_update = true
         AND (earliest_update_at IS NULL OR earliest_update_at <= now())
         AND (
           last_checked_at IS NULL
           OR last_checked_at + (update_interval_days || ' days')::interval <= now()
         )
       ORDER BY created_at DESC`,
    );
    return result.rows.map(mapRow);
  },

  async getById(id) {
    const result = await getDatabase().query<QuestionRow>(
      `SELECT ${SELECT_COLUMNS} FROM questions WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async random() {
    const result = await getDatabase().query<QuestionRow>(
      `SELECT ${SELECT_COLUMNS} FROM questions ORDER BY random() LIMIT 1`,
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async create({
    question,
    answer,
    options,
    category,
    type,
    autoUpdate,
    updateIntervalDays,
    earliestUpdateAt,
    answerAsOf,
  }) {
    const result = await getDatabase().query<QuestionRow>(
      `INSERT INTO questions
         (question, answer, options, category, type, auto_update,
          update_interval_days, earliest_update_at, answer_as_of)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
       RETURNING ${SELECT_COLUMNS}`,
      [
        question,
        answer,
        JSON.stringify(options),
        category,
        type,
        autoUpdate,
        updateIntervalDays,
        earliestUpdateAt,
        answerAsOf,
      ],
    );
    return mapRow(result.rows[0]);
  },

  async update(
    id,
    {
      question,
      answer,
      options,
      category,
      type,
      autoUpdate,
      updateIntervalDays,
      earliestUpdateAt,
      answerAsOf,
    },
  ) {
    const result = await getDatabase().query<QuestionRow>(
      `UPDATE questions
       SET question = $2, answer = $3, options = $4::jsonb, category = $5, type = $6,
           auto_update = $7, update_interval_days = $8,
           earliest_update_at = $9, answer_as_of = $10
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        question,
        answer,
        JSON.stringify(options),
        category,
        type,
        autoUpdate,
        updateIntervalDays,
        earliestUpdateAt,
        answerAsOf,
      ],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async markChecked(id) {
    await getDatabase().query(
      `UPDATE questions SET last_checked_at = now() WHERE id = $1`,
      [id],
    );
  },

  async updateTiming(id, { updateIntervalDays, earliestUpdateAt }) {
    await getDatabase().query(
      `UPDATE questions
       SET update_interval_days = $2, earliest_update_at = $3
       WHERE id = $1`,
      [id, updateIntervalDays, earliestUpdateAt],
    );
  },

  async remove(id) {
    const result = await getDatabase().query(`DELETE FROM questions WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
