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

// ─── Encoding & Text Normalization ──────────────────────────────────────────

/**
 * Detects and repairs UTF-8 mojibake (e.g. "Táº¥n ThÃ nh" → "Tấn Thành")
 * caused by UTF-8 bytes being mistakenly interpreted as Windows-1252 / Latin-1.
 */
export const fixMojibake = (str?: string | null): string => {
  if (!str || typeof str !== 'string') return '';
  if (!/[\u00C0-\u00FF][\u0080-\u00FF]/.test(str)) return str;
  try {
    const bytes = new Uint8Array([...str].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return str;
  }
};

// ─── User Initials ────────────────────────────────────────────────────────────

export const getInitials = (name?: string | null, max = 2): string => {
  const clean = fixMojibake(name);
  if (!clean) return 'U';
  return (
    clean
      .split(' ')
      .filter(Boolean)
      .slice(0, max)
      .map((n) => n[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  );
};

