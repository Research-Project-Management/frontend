/**
 * Utility functions for formatting and displaying citations cleanly
 * across Citation sidebar tabs and inspection modals.
 */

import type { BibEntry } from '@/features/editor/utils/bib-parser.util';

/**
 * Cleans raw abstract text:
 * - Strips leading 'Abstract:', 'Abstract — ', 'BACKGROUND:' or redundant labels
 * - Cleans excessive whitespace and trims
 */
export function cleanAbstractText(rawAbstract?: string): string {
  if (!rawAbstract || typeof rawAbstract !== 'string') return '';
  return rawAbstract
    .replace(/^(?:abstract\s*[:\-\u2013\u2014]\s*)+/i, '')
    .replace(/^(?:background\s*[:\-\u2013\u2014]\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats venue, journal, booktitle, volume, number, and pages into a concise string.
 */
export function formatVenueString(entry?: {
  journal?: string;
  booktitle?: string;
  publisher?: string;
  volume?: string;
  number?: string;
  pages?: string;
}): string {
  if (!entry) return '';
  return [
    entry.journal || entry.booktitle || entry.publisher,
    entry.volume ? `Vol. ${entry.volume}` : '',
    entry.number ? `No. ${entry.number}` : '',
    entry.pages ? `pp. ${entry.pages}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Generates an author summary string (e.g. "Smith & Doe" or "Vaswani et al.").
 */
export function formatAuthorsSummary(authors?: string[]): string {
  if (!authors || authors.length === 0) {
    return 'Unknown author';
  }
  if (authors.length === 1) {
    return authors[0];
  }
  if (authors.length === 2) {
    return `${authors[0]} & ${authors[1]}`;
  }
  return `${authors[0]} et al.`;
}
