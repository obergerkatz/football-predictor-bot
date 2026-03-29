/**
 * Time-related constants
 */

// Timezone
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

// Locales
export const DEFAULT_LOCALE = 'en-US';
export const NOTIFICATION_LOCALE = 'en-GB';

// Time intervals in milliseconds
export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
} as const;

// Session timeouts (in milliseconds)
export const SESSION_TIMEOUT = {
  BET: 5 * TIME_MS.MINUTE,
  GROUP_STAGE_PREDICTION: 10 * TIME_MS.MINUTE,
  TOURNAMENT_PREDICTION: 10 * TIME_MS.MINUTE,
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  UPCOMING_MATCHES: 5 * 60, // 5 minutes
  TODAY_MATCHES: 60, // 1 minute
  FINISHED_MATCHES: 30 * 60, // 30 minutes
  MATCH_BY_ID: 5 * 60, // 5 minutes
  LIVE_MATCHES: 30, // 30 seconds
} as const;

// Cache cleanup interval (in milliseconds)
export const CACHE_CLEANUP_INTERVAL = 5 * TIME_MS.MINUTE;

// Notification time windows (in milliseconds)
export const NOTIFICATION_WINDOW = {
  PRE_MATCH_MIN: TIME_MS.HOUR, // 1 hour before match
  PRE_MATCH_MAX: 2 * TIME_MS.HOUR, // 2 hours before match
  POST_MATCH: 2 * TIME_MS.HOUR, // 2 hours after match
} as const;

// Database pool timeouts (in milliseconds)
export const DB_TIMEOUT = {
  IDLE: 30000,
  CONNECTION: 2000,
} as const;

// API timeout (in milliseconds)
export const API_TIMEOUT = 10000;
