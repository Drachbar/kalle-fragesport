-- Ett AI-jobb som går igenom tidskänsliga frågor och föreslår nya svar.
-- Status pollas av frontend medan jobbet kör i bakgrunden.
CREATE TABLE auto_update_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total               INTEGER     NOT NULL DEFAULT 0,
  processed           INTEGER     NOT NULL DEFAULT 0,
  suggestions_created INTEGER     NOT NULL DEFAULT 0,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at         TIMESTAMPTZ
);
