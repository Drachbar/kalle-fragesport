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
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLUMNS =
  "id, question, answer, options, category, type, auto_update, created_at, updated_at";

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface QuestionsRepository {
  list(): Promise<Question[]>;
  listAutoUpdate(): Promise<Question[]>;
  getById(id: string): Promise<Question | null>;
  random(): Promise<Question | null>;
  create(input: QuestionInput): Promise<Question>;
  update(id: string, input: QuestionInput): Promise<Question | null>;
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

  async create({ question, answer, options, category, type, autoUpdate }) {
    const result = await getDatabase().query<QuestionRow>(
      `INSERT INTO questions (question, answer, options, category, type, auto_update)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [question, answer, JSON.stringify(options), category, type, autoUpdate],
    );
    return mapRow(result.rows[0]);
  },

  async update(id, { question, answer, options, category, type, autoUpdate }) {
    const result = await getDatabase().query<QuestionRow>(
      `UPDATE questions
       SET question = $2, answer = $3, options = $4::jsonb, category = $5, type = $6, auto_update = $7
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, question, answer, JSON.stringify(options), category, type, autoUpdate],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async remove(id) {
    const result = await getDatabase().query(`DELETE FROM questions WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
