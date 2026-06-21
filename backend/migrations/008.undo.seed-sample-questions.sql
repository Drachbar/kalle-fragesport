-- Ta endast bort de deterministiska UUID:n som migration 008 skapade.
DELETE FROM questions
WHERE id IN (
  SELECT (
    '00000000-0000-4000-8000-' || lpad(seed_number::text, 12, '0')
  )::uuid
  FROM generate_series(1, 50) AS seed(seed_number)
);
