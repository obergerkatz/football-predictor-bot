/**
 * UI messages and error text constants
 */

// Error messages
export const ERROR_MESSAGES = {
  USER_NOT_FOUND: '❌ User Not Found\n\nPlease tap the /start button to register first.',
  GENERIC_ERROR: '❌ Oops! Something went wrong.\n\n',
  MATCH_NOT_FOUND: 'Match not found',
  COMPETITION_NOT_FOUND: 'Competition not found',
  FIXTURE_NOT_FOUND: 'Fixture not found',
  TEAMS_NOT_FOUND: 'Teams not found',
  USER_NOT_FOUND_FOR_BET: 'User not found for bet',
  MATCH_NOT_FOUND_IN_API: 'Match not found in API',
} as const;

// Service error prefixes
export const SERVICE_ERROR_PREFIX = {
  FAILED_TO_SCORE_BET: 'Failed to score bet',
  FAILED_TO_SCORE_MATCH_BETS: 'Failed to score match bets',
  FAILED_TO_GET_LEADERBOARD: 'Failed to get leaderboard',
  FAILED_TO_GET_USER_RANK: 'Failed to get user rank',
  FAILED_TO_GET_TODAY_MATCHES: 'Failed to get today matches',
  FAILED_TO_GET_UPCOMING_MATCHES: 'Failed to get upcoming matches',
  FAILED_TO_GET_RECENT_FINISHED_MATCHES: 'Failed to get recent finished matches',
  FAILED_TO_GET_FINISHED_AND_LIVE_MATCHES: 'Failed to get finished and live matches',
} as const;

// Status display text
export const MATCH_STATUS_DISPLAY = {
  LIVE: 'LIVE',
} as const;
