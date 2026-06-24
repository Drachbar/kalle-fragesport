-- Hur ofta en tidskänslig fråga bör kontrolleras av AI:n, samt när den senast
-- kontrollerades. last_checked_at är skilt från updated_at (som triggern sätter
-- vid varje edit) och styr när en fråga är "förfallen" för en ny AI-kontroll.
ALTER TABLE questions
  ADD COLUMN update_interval_days INTEGER NOT NULL DEFAULT 30
    CHECK (update_interval_days >= 1),
  ADD COLUMN last_checked_at TIMESTAMPTZ;
