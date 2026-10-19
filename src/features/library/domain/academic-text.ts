/**
 * Academic Text & Author Formatting Utilities
 *
 * NOTE: The Backend Server is the authoritative single source of truth for
 * OCR cleanup, artifact filtering, and academic text extraction.
 *
 * This file provides UI presentation helpers for normalizing whitespace in
 * titles and formatting multi-author strings for display.
 */

import { normalizeAuthors, parseCreatorName } from '@/features/library/domain/creators';

const ASCII_ONLY_RE = /^[\x00-\x7F]*$/;
const SPECIAL_LATIN_FOLD_RE = /[ĐđŁłØøßÆæŒœ]/g;
const COMBINING_DIACRITIC_RE = /[\u0300-\u036f]/g;
const SPECIAL_LATIN_MAP: Readonly<Record<string, string>> = {
  Đ: 'd',
  đ: 'd',
  Ł: 'l',
  ł: 'l',
  Ø: 'o',
  ø: 'o',
  ß: 'ss',
  Æ: 'ae',
  æ: 'ae',
  Œ: 'oe',
  œ: 'oe',
};

const BROKEN_HYPHEN_RE = /(\b[A-Za-z0-9]+)\s*[-‐‑‒–—−]\s*([A-Za-z0-9]+\b)/g;
const MULTI_WHITESPACE_RE = /\s+/g;
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*(.*)$/u;

/**
 * Transliterates and folds Unicode diacritics into lowercase ASCII characters
 * for diacritic-insensitive search and key normalization.
 * Uses an O(1) ASCII fast-path to bypass NFD normalization when no non-ASCII characters exist.
 */
export function foldDiacritics(input?: string | null): string {
  if (!input) return '';
  if (ASCII_ONLY_RE.test(input)) {
    return input.toLowerCase();
  }
  return input
    .replace(SPECIAL_LATIN_FOLD_RE, (m) => SPECIAL_LATIN_MAP[m] ?? m)
    .normalize('NFD')
    .replace(COMBINING_DIACRITIC_RE, '')
    .toLowerCase();
}

/**
 * Normalizes broken hyphens and irregular whitespace in academic titles/venues.
 */
export function cleanAcademicText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(BROKEN_HYPHEN_RE, '$1-$2')
    .replace(MULTI_WHITESPACE_RE, ' ')
    .trim();
}

/**
 * Formats authors array or string into clean academic citation format.
 * - If 1-3 authors: joins with commas
 * - If 4+ authors: shows first 3 + "et al." (or custom maxAuthors)
 */
export function formatAcademicAuthors(
  authors: unknown,
  maxAuthors = 3,
): string {
  if (!authors) return '—';

  const rawList = normalizeAuthors(authors);
  if (!rawList || rawList.length === 0) return '—';

  const cleaned = rawList
    .map((name) => {
      const clean = cleanAcademicText(name);
      if (!clean) return '';
      // Format "LastName, FirstName" to "FirstName LastName" for display readability
      if (clean.includes(',')) {
        const parsed = parseCreatorName(clean);
        return parsed.fullName || clean;
      }
      return clean;
    })
    .filter((a) => a && a.length >= 2);

  if (cleaned.length === 0) return '—';
  if (cleaned.length <= maxAuthors) return cleaned.join(', ');
  return `${cleaned.slice(0, maxAuthors).join(', ')} et al.`;
}

/**
 * Detects and extracts a leading emoji from a title/label.
 * If present, returns { emoji, label: textWithoutEmoji }.
 */
export function parseEmojiPrefix(text?: string | null): { emoji: string | null; label: string } {
  if (!text) return { emoji: null, label: '' };
  const trimmed = text.trim();
  const match = trimmed.match(LEADING_EMOJI_RE);
  if (match) {
    return {
      emoji: match[1],
      label: match[2].trim() || trimmed,
    };
  }
  return { emoji: null, label: trimmed };
}

export {
  resolveOpenAccessLicenseBadge,
  type OpenAccessLicenseBadge,
} from './system-views.policy';
