-- Trigger-funktion som sätter updated_at till now() vid varje UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Frågor i frågesporten.
CREATE TABLE questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT        NOT NULL,
  answer     TEXT        NOT NULL,
  options    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  category   TEXT,
  type       TEXT        NOT NULL DEFAULT 'multiple_choice'
                CHECK (type IN ('multiple_choice', 'free_text', 'true_false')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- options måste vara en JSON-array (t.ex. ["Stockholm", "Oslo"]).
ALTER TABLE questions
  ADD CONSTRAINT questions_options_is_array
  CHECK (jsonb_typeof(options) = 'array');

CREATE TRIGGER questions_set_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
