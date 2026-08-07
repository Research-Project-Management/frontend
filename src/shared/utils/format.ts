/**
 * shared/utils/format.ts
 * Pure formatting utilities — no side effects, fully tree-shakeable.
 */

// ─── Date ─────────────────────────────────────────────────────────────────────

/**
 * Format a date to a human-readable string.
 * @example formatDate('2026-01-07') → "Jan 7, 2026"
 */
export const formatDate = (
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
  locale = 'en-US',
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, options).format(d);
};

/**
 * Format a date relative to now.
 * @example formatRelativeTime(new Date(Date.now() - 3600000)) → "1 hour ago"
 */
export const formatRelativeTime = (date: string | Date, locale = 'en-US'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  if (Math.abs(diffSec) < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute');
  if (Math.abs(diffSec) < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour');
  if (Math.abs(diffSec) < 2592000) return rtf.format(-Math.floor(diffSec / 86400), 'day');
  if (Math.abs(diffSec) < 31536000) return rtf.format(-Math.floor(diffSec / 2592000), 'month');
  return rtf.format(-Math.floor(diffSec / 31536000), 'year');
};

// ─── File Size ────────────────────────────────────────────────────────────────

/**
 * Format bytes into a human-readable size string.
 * @example formatBytes(1536) → "1.5 KB"
 */
export const formatBytes = (bytes: number, decimals = 1): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${units[i]}`;
};

// ─── Number ───────────────────────────────────────────────────────────────────

/**
 * Compact number formatting.
 * @example formatNumber(1500000) → "1.5M"
 */
export const formatNumber = (value: number, locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

// ─── String ───────────────────────────────────────────────────────────────────

/**
 * Truncate a string with ellipsis.
 * @example truncate("Hello World", 8) → "Hello..."
 */
export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
};

/**
 * Capitalize the first letter of a string.
 */
export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

/**
 * Convert camelCase or snake_case to a human-readable label.
 * @example toLabel('createdAt') → "Created At"
 */
export const toLabel = (str: string): string =>
  str
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Get user initials from a full name.
 * @example getInitials("Nguyen Van A") → "NV"
 */
export const getInitials = (name: string, max = 2): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, max)
    .map((n) => n[0].toUpperCase())
    .join('');
