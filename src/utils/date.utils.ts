/**
 * Date formatting utility functions
 */

import { DEFAULT_TIMEZONE, DEFAULT_LOCALE, NOTIFICATION_LOCALE } from '../constants';

/**
 * Format date with full details: day/month/year and time
 * Example: "15/03/2026 14:30"
 */
export function formatDateTimeFull(date: Date): string {
  return new Intl.DateTimeFormat(NOTIFICATION_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Format date with short month, day, and time
 * Example: "Mar 15, 2:30 PM"
 */
export function formatDateTimeShort(date: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Format date with weekday, short month, day, and time
 * Example: "Mon, Mar 15, 2:30 PM"
 */
export function formatDateTimeWithWeekday(date: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Format time only (24-hour format)
 * Example: "14:30"
 */
export function formatTime24Hour(date: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Format time only (12-hour format with AM/PM)
 * Example: "2:30 PM"
 */
export function formatTime12Hour(date: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Format date only with short month and day (no time)
 * Example: "Mar 15"
 */
export function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Format date with short month, day, and year (no time)
 * Example: "Mar 15, 2026"
 */
export function formatDateWithYear(date: Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}
