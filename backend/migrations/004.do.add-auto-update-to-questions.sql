-- Markerar frågor vars svar är tidskänsliga och ska kunna uppdateras av AI.
ALTER TABLE questions
  ADD COLUMN auto_update BOOLEAN NOT NULL DEFAULT false;
