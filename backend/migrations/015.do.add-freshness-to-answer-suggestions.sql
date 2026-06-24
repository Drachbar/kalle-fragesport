-- Färskhetsdata för ett förslag:
--   suggested_earliest_update_at: AI:ns förslag på tidigast nästa kontroll.
--   answer_as_of: datum det föreslagna svaret gäller per (sätts på frågan vid godkännande).
--   older_than_current: true om AI:ns källa är äldre än frågans nuvarande svar – flaggas
--     för granskaren i stället för att blockeras.
-- Kolumnen `sources` (jsonb) byter innehåll från string[] till [{ url, publishedAt }];
-- ingen schemaändring behövs eftersom jsonb är schemalöst.
ALTER TABLE answer_suggestions
  ADD COLUMN suggested_earliest_update_at TIMESTAMPTZ,
  ADD COLUMN answer_as_of                 TIMESTAMPTZ,
  ADD COLUMN older_than_current           BOOLEAN NOT NULL DEFAULT false;
