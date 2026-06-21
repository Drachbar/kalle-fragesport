-- AI:ns föreslagna svar som väntar på admins granskning.
-- previous_answer är en ögonblicksbild av frågans svar när förslaget skapades,
-- så granskningsvyn kan visa "gammalt → nytt" även om frågan hinner ändras.
CREATE TABLE answer_suggestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  job_id           UUID        REFERENCES auto_update_jobs(id) ON DELETE SET NULL,
  previous_answer  TEXT        NOT NULL,
  suggested_answer TEXT        NOT NULL,
  sources          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  reasoning        TEXT,
  confidence       REAL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sources måste vara en JSON-array (t.ex. ["https://...", "https://..."]).
ALTER TABLE answer_suggestions
  ADD CONSTRAINT answer_suggestions_sources_is_array
  CHECK (jsonb_typeof(sources) = 'array');

-- Snabb hämtning av väntande förslag i granskningsvyn.
CREATE INDEX idx_answer_suggestions_pending
  ON answer_suggestions (created_at DESC)
  WHERE status = 'pending';
