/**
 * Academic Text & Author Cleaning Utilities
 *
 * Normalizes broken hyphens and irregular whitespace frequently introduced
 * by GROBID / PDF extraction pipelines (e.g. "Real- Time" -> "Real-Time",
 * "Large -Scale" -> "Large-Scale", "U -Net" -> "U-Net").
 * Filters common OCR artifact tokens that mistakenly get tagged as author names.
 */

import { normalizeAuthors, parseCreatorName } from '../domain/creators';

export const JUNK_AUTHOR_PATTERNS = [
  /^\s*a\s*b\s*s\s*t\s*r\s*a\s*c\s*t\b/i,
  /^\s*i\s*n\s*t\s*r\s*o\s*d\s*u\s*c\s*t\s*i\s*o\s*n\b/i,
  /^\s*c\s*o\s*n\s*c\s*l\s*u\s*s\s*i\s*o\s*n\b/i,
  /^\s*m\s*e\s*t\s*h\s*o\s*d\b/i,
  /^\s*r\s*e\s*s\s*u\s*l\s*t\s*s\b/i,
  /^\s*r\s*e\s*f\s*e\s*r\s*e\s*n\s*c\s*e\s*s\b/i,
  /^\s*d\s*i\s*s\s*c\s*u\s*s\s*s\s*i\s*o\s*n\b/i,
  /^\s*e\s*m\s*p\s*i\s*r\s*i\s*c\s*a\s*l\b/i,
  /^\s*b\s*a\s*c\s*k\s*g\s*r\s*o\s*u\s*n\s*d\b/i,
  /^\s*a\s*c\s*k\s*n\s*o\s*w\s*l\s*e\s*d\s*g/i,
  /\b(imagenet|neural networks?|deep learning|image segmentation|convolutional)\b/i,
  /\b(university|department|faculty|laboratory|institute|proceedings|conference|ieee|arxiv)\b/i,
  /^\s*table\s+\d+/i,
  /^\s*figure\s+\d+/i,
  /^\s*fig\.\s*\d+/i,
  /^\s*vol\.\s*\d+/i,
  /^\s*no\.\s*\d+/i,
  /^\s*pp\.\s*\d+/i,
  /^\s*page\s+\d+/i,
];

/**
 * Normalizes broken hyphens and irregular whitespace in academic titles/venues.
 */
export function cleanAcademicText(text?: string | null): string {
  if (!text) return '';
  return text
    // Replace all unicode dashes/hyphens flanked by whitespace between words
    .replace(/(\b[A-Za-z0-9]+)\s*[-‐‑‒–—−]\s*([A-Za-z0-9]+\b)/g, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats authors array or string into clean academic citation format.
 * - Extracts authors from strings, arrays, or creator objects (including CSL-JSON)
 * - Splits composite author strings (; and & commas)
 * - Converts inverted "LastName, FirstName" to natural "FirstName LastName" for legible commas
 * - Filters OCR junk and footnote markers
 * - If 1-3 authors: joins with commas
 * - If 4+ authors: shows first 3 + "et al." (or custom maxAuthors)
 */
export function formatAcademicAuthors(authors: any, maxAuthors = 3): string {
  if (!authors) return '—';

  const rawList = normalizeAuthors(authors);
  if (!rawList || rawList.length === 0) return '—';

  const cleaned = rawList
    .map((name) => {
      const clean = cleanAcademicText(name);
      if (!clean) return '';
      if (JUNK_AUTHOR_PATTERNS.some((pat) => pat.test(clean))) return '';
      // Format "LastName, FirstName" to "FirstName LastName" for display readability
      if (clean.includes(',')) {
        const parsed = parseCreatorName(clean);
        return parsed.fullName || clean;
      }
      return clean;
    })
    .filter((a) => a && a.length >= 2 && !JUNK_AUTHOR_PATTERNS.some((pat) => pat.test(a)));

  if (cleaned.length === 0) return '—';
  if (cleaned.length <= maxAuthors) return cleaned.join(', ');
  return `${cleaned.slice(0, maxAuthors).join(', ')} et al.`;
}
