/**
 * Database field name constants
 */

// Table names
export const TABLE_NAMES = {
  BETS: 'bets',
  MATCHES: 'matches',
  USERS: 'users',
  LEAGUES: 'leagues',
  SCORES: 'scores',
  GROUP_STAGE_PREDICTIONS: 'group_stage_predictions',
  TOURNAMENT_PREDICTIONS: 'tournament_predictions',
  NOTIFICATIONS: 'notifications',
} as const;

// Common field names
export const DB_FIELDS = {
  // Match-related
  API_FIXTURE_ID: 'api_fixture_id',
  API_LEAGUE_ID: 'api_league_id',

  // Bet/Prediction fields
  PREDICTED_HOME_SCORE: 'predicted_home_score',
  PREDICTED_AWAY_SCORE: 'predicted_away_score',

  // Score fields
  HOME_SCORE: 'home_score',
  AWAY_SCORE: 'away_score',

  // ID fields
  USER_ID: 'user_id',
  MATCH_ID: 'match_id',
  LEAGUE_ID: 'league_id',
} as const;
