-- Migration 014: Create top goalscorer predictions table

CREATE TABLE top_goalscorer_predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  predicted_player VARCHAR(100) NOT NULL,
  bonus_points INTEGER DEFAULT 0,
  is_scored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, league_id)
);
