-- AI:ns rekommenderade kontrollintervall (dagar) för frågan. Appliceras på
-- frågans update_interval_days när förslaget godkänns.
ALTER TABLE answer_suggestions
  ADD COLUMN suggested_interval_days INTEGER;
