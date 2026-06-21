import { getDatabase } from "../db";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface AutoUpdateJob {
  id: string;
  status: JobStatus;
  total: number;
  processed: number;
  suggestionsCreated: number;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

/** Fält som kan uppdateras medan jobbet kör. */
export interface JobPatch {
  status?: JobStatus;
  total?: number;
  processed?: number;
  suggestionsCreated?: number;
  error?: string | null;
  finishedAt?: Date | null;
}

interface JobRow {
  id: string;
  status: JobStatus;
  total: number;
  processed: number;
  suggestions_created: number;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

const SELECT_COLUMNS =
  "id, status, total, processed, suggestions_created, error, created_at, finished_at";

function mapRow(row: JobRow): AutoUpdateJob {
  return {
    id: row.id,
    status: row.status,
    total: row.total,
    processed: row.processed,
    suggestionsCreated: row.suggestions_created,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

// Mappar JobPatch-nycklar till kolumnnamn för dynamisk UPDATE.
const PATCH_COLUMNS: Record<keyof JobPatch, string> = {
  status: "status",
  total: "total",
  processed: "processed",
  suggestionsCreated: "suggestions_created",
  error: "error",
  finishedAt: "finished_at",
};

export interface JobsRepository {
  create(): Promise<AutoUpdateJob>;
  getById(id: string): Promise<AutoUpdateJob | null>;
  update(id: string, patch: JobPatch): Promise<AutoUpdateJob | null>;
  /** Finns ett jobb som redan kör (pending/running)? Hindrar parallella körningar. */
  hasActive(): Promise<boolean>;
}

export const jobsRepository: JobsRepository = {
  async create() {
    const result = await getDatabase().query<JobRow>(
      `INSERT INTO auto_update_jobs DEFAULT VALUES RETURNING ${SELECT_COLUMNS}`,
    );
    return mapRow(result.rows[0]);
  },

  async getById(id) {
    const result = await getDatabase().query<JobRow>(
      `SELECT ${SELECT_COLUMNS} FROM auto_update_jobs WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async update(id, patch) {
    const entries = (Object.keys(patch) as (keyof JobPatch)[]).filter(
      (key) => patch[key] !== undefined,
    );
    if (entries.length === 0) {
      return this.getById(id);
    }

    const setClauses = entries.map(
      (key, i) => `${PATCH_COLUMNS[key]} = $${i + 2}`,
    );
    const values = entries.map((key) => patch[key]);

    const result = await getDatabase().query<JobRow>(
      `UPDATE auto_update_jobs
       SET ${setClauses.join(", ")}
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, ...values],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  },

  async hasActive() {
    const result = await getDatabase().query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM auto_update_jobs WHERE status IN ('pending', 'running')
       ) AS exists`,
    );
    return result.rows[0]?.exists ?? false;
  },
};
