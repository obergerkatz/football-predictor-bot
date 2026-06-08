-- Migration 013: Change tournament predictions from top 4 to top 2
-- Removes third_place and fourth_place columns

ALTER TABLE tournament_predictions
  DROP COLUMN IF EXISTS third_place,
  DROP COLUMN IF EXISTS fourth_place;
