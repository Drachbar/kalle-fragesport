-- earliest_update_at: hoppa över frågan i auto-uppdateringen tills detta datum
--   (t.ex. valdag eller mästerskapsfinal) även om intervallet löpt ut.
-- answer_as_of: datum då det nuvarande svaret är aktuellt. Används som färskhets-
--   gräns så att AI:n inte föreslår äldre information än den vi redan har.
ALTER TABLE questions
  ADD COLUMN earliest_update_at TIMESTAMPTZ,
  ADD COLUMN answer_as_of       TIMESTAMPTZ;
