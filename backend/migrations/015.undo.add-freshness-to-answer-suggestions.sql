ALTER TABLE answer_suggestions
  DROP COLUMN suggested_earliest_update_at,
  DROP COLUMN answer_as_of,
  DROP COLUMN older_than_current;
