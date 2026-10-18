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

/**
 * Transliterates and folds Unicode diacritics into lowercase ASCII characters
 * for diacritic-insensitive search and key normalization.
 */
export function foldDiacritics(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/[Đđ]/g, (m) => (m === 'Đ' ? 'D' : 'd'))
    .replace(/[Łł]/g, (m) => (m === 'Ł' ? 'L' : 'l'))
    .replace(/[Øø]/g, (m) => (m === 'Ø' ? 'O' : 'o'))
    .replace(/ß/g, 'ss')
    .replace(/[Ææ]/g, 'ae')
    .replace(/[Œœ]/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Normalizes broken hyphens and irregular whitespace in academic titles/venues.
 */
export function cleanAcademicText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/(\b[A-Za-z0-9]+)\s*[-‐‑‒–—−]\s*([A-Za-z0-9]+\b)/g, '$1-$2')
    .replace(/\s+/g, ' ')
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
  const match = trimmed.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*(.*)$/u);
  if (match) {
    return {
      emoji: match[1],
      label: match[2].trim() || trimmed,
    };
  }
  return { emoji: null, label: trimmed };
}

export interface OpenAccessLicenseBadge {
  code: string;
  label: string;
  isOpenAccess: boolean;
  url: string;
}

/**
 * Resolves Open Access license badge metadata (CC-BY-4.0, CC0-1.0, etc.)
 */
export function resolveOpenAccessLicenseBadge(item: { license?: string | null }): OpenAccessLicenseBadge | null {
  if (!item?.license) return null;
  const raw = item.license.trim().toUpperCase();

  if (raw === 'CC-BY-4.0' || raw === 'CC-BY' || raw === 'CC BY 4.0') {
    return {
      code: 'CC-BY-4.0',
      label: 'CC BY 4.0',
      isOpenAccess: true,
      url: 'https://creativecommons.org/licenses/by/4.0/',
    };
  }

  if (raw === 'CC0-1.0' || raw === 'CC0' || raw === 'CC0 1.0') {
    return {
      code: 'CC0-1.0',
      label: 'CC0 1.0 Public Domain',
      isOpenAccess: true,
      url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    };
  }

  return null;
}
