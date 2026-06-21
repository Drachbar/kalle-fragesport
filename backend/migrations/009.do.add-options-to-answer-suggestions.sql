-- Spara alternativen som de såg ut vid granskningen och AI:ns kompletta
-- föreslagna lista. Befintliga förslag får frågans nuvarande alternativ.
ALTER TABLE answer_suggestions
  ADD COLUMN previous_options JSONB,
  ADD COLUMN suggested_options JSONB;

UPDATE answer_suggestions AS suggestion
SET previous_options = question.options,
    suggested_options = question.options
FROM questions AS question
WHERE question.id = suggestion.question_id;

ALTER TABLE answer_suggestions
  ALTER COLUMN previous_options SET NOT NULL,
  ALTER COLUMN suggested_options SET NOT NULL,
  ADD CONSTRAINT answer_suggestions_previous_options_is_array
    CHECK (jsonb_typeof(previous_options) = 'array'),
  ADD CONSTRAINT answer_suggestions_suggested_options_is_array
    CHECK (jsonb_typeof(suggested_options) = 'array');
