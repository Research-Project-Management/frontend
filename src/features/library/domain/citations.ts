/**
 * Presentation Model: Citations & Citation Keys
 *
 * NOTE: The Backend Server (ExportsService, CslEngineService, CitationKeyEngine)
 * is the authoritative single source of truth for citation rendering, export,
 * and key persistence.
 *
 * This module provides purely lightweight presentation helpers for:
 * - Formatting citation keys for UI preview / unpersisted items
 * - Formatting citation style labels for toolbars, dropdowns, and badges
 */

import type { Item, CslStyle } from '@/features/library/domain/types/library.types';
import { parseCreatorName } from './creators';
import {
  stripLatexMarkup,
  isValidValue,
  parseItemExtraField,
  getItemDisplayTitle,
  getItemDisplayDate,
} from './metadata';
import { foldDiacritics } from './academic-text';

export interface CitationKeyInput {
  title?: string | null;
  authors?: Array<string | { name?: string | null; fullName?: string | null; lastName?: string | null; [key: string]: unknown }> | null;
  creators?: Array<{ firstName?: string | null; lastName?: string | null; fullName?: string | null; name?: string | null; creatorType?: string | null; [key: string]: unknown }> | null;
  year?: number | string | null;
  doi?: string | null;
  citationKey?: string | null;
  key?: string | null;
  id?: string | null;
  extra?: string | null;
  extraFields?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/**
 * Transliterates Unicode diacritics (e.g., Đ/đ -> d, Ł/ł -> l, Ø/ø -> o, ß -> ss, NFD combining marks)
 * into clean ASCII lowercase alphanumeric characters for BibTeX keys.
 */
export function toAsciiKeyPart(raw: string): string {
  if (!raw) return '';
  return foldDiacritics(stripLatexMarkup(raw)).replace(/[^a-z0-9]/g, '');
}

const CITATION_KEY_STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'on',
  'in',
  'of',
  'for',
  'and',
  'to',
  'with',
  'by',
  'from',
  'at',
  'as',
  'into',
  'towards',
  'toward',
  'via',
  'using',
  'is',
]);

/**
 * Computes a fallback BibTeX citation key preview for unpersisted items or client UI display.
 * Format: {firstAuthorSurname}{year}{firstSignificantTitleWord}
 *
 * Note: Authoritative key generation and collision avoidance are managed by the
 * backend CitationKeyEngine.
 */
export function generateCitationKey(
  item?: Partial<Item> | CitationKeyInput | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!item) return 'ref';

  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};
  const parsedExtra = parseItemExtraField(
    (item as CitationKeyInput).extra || (item as CitationKeyInput).extraFields,
  );
  const extraCiteKey = parsedExtra.citationKey || parsedExtra.citekey || (ef.citationKey as string | undefined);

  let baseKey = '';

  let authorPart = '';
  const rawAuthors =
    Array.isArray((item as CitationKeyInput).creators) && (item as CitationKeyInput).creators!.length > 0
      ? (item as CitationKeyInput).creators
      : Array.isArray(item.authors) && item.authors.length > 0
        ? item.authors
        : null;

  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const firstAuthor = rawAuthors[0];
    const authorObj = typeof firstAuthor === 'object' && firstAuthor ? (firstAuthor as Record<string, unknown>) : null;
    let authorStr = '';
    if (typeof firstAuthor === 'string') {
      const parsed = parseCreatorName(firstAuthor);
      authorStr = parsed.lastName || parsed.fullName;
    } else if (authorObj) {
      if (typeof authorObj.lastName === 'string' && isValidValue(authorObj.lastName)) {
        authorStr = authorObj.lastName;
      } else if (typeof authorObj.family === 'string' && isValidValue(authorObj.family)) {
        authorStr = authorObj.family;
      } else {
        const rawName = String(authorObj.name || authorObj.fullName || '');
        const parsed = parseCreatorName(rawName);
        authorStr = parsed.lastName || parsed.fullName;
      }
    }
    authorPart = toAsciiKeyPart(authorStr);
  }

  let yearPart = '';
  const rawYear =
    item.year ||
    getItemDisplayDate(rec) ||
    parsedExtra.originalDate ||
    parsedExtra.date;
  if (rawYear && isValidValue(rawYear)) {
    const y = String(rawYear).match(/\b\d{4}\b/);
    if (y) yearPart = y[0];
  }

  let titlePart = '';
  const effectiveTitle = getItemDisplayTitle(rec) || item.title;
  if (effectiveTitle && isValidValue(effectiveTitle)) {
    const cleanTitle = stripLatexMarkup(String(effectiveTitle))
      .replace(/[đĐ]/g, 'd')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const words =
      cleanTitle
        .replace(/[^a-z0-9\s]/g, '')
        .match(/[a-z0-9]{3,}/g) || [];
    titlePart =
      words.find((w) => !CITATION_KEY_STOP_WORDS.has(w)) || words[0] || '';
  }

  if (item.citationKey && isValidValue(item.citationKey)) {
    baseKey = String(item.citationKey).trim().replace(/\s+/g, '');
  } else if (extraCiteKey && isValidValue(extraCiteKey)) {
    baseKey = String(extraCiteKey).trim().replace(/\s+/g, '');
  } else if (authorPart || yearPart || titlePart) {
    baseKey = `${authorPart || 'anon'}${yearPart || 'nd'}${titlePart || 'work'}`;
  } else if (rec.key && isValidValue(rec.key)) {
    baseKey = String(rec.key).trim().replace(/\s+/g, '');
  } else if (item.id) {
    baseKey = `item_${item.id.slice(0, 8)}`;
  } else {
    baseKey = 'ref';
  }

  baseKey = baseKey.toLowerCase().replace(/[^a-z0-9_:-]/g, '');

  if (!existingKeys) {
    return baseKey;
  }

  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  if (!keySet.has(baseKey)) {
    return baseKey;
  }

  const suffixes = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < suffixes.length; i++) {
    const candidate = `${baseKey}${suffixes[i]}`;
    if (!keySet.has(candidate)) {
      return candidate;
    }
  }

  let counter = 2;
  while (keySet.has(`${baseKey}_${counter}`)) {
    counter++;
  }
  return `${baseKey}_${counter}`;
}

/**
 * Normalizes full academic journal or style names into clean, compact
 * toolbar button labels (<= 14 characters) that will not break container layout.
 */
export function getCleanStyleLabel(id: string, fullTitle?: string): string {
  if (fullTitle) {
    const clean = fullTitle.replace(/\s*\([^)]*\)/g, '').trim();
    if (clean.length <= 14) return clean;
    const firstWord = clean.split(/\s+/)[0];
    if (firstWord && firstWord.length <= 14) return firstWord;
  }
  const s = id.toLowerCase().trim();
  if (s.startsWith('apa')) return 'APA';
  if (s.startsWith('mla')) return 'MLA';
  if (s === 'ieee') return 'IEEE';
  if (s === 'bibtex') return 'BibTeX';
  if (s === 'ris') return 'RIS';
  if (s.startsWith('chicago')) return 'Chicago';
  if (s.startsWith('harvard')) return 'Harvard';
  if (s.startsWith('vancouver')) return 'Vancouver';
  if (s.startsWith('nature')) return 'Nature';
  if (s.startsWith('tcvn')) return 'TCVN';
  const cleanId = id.toUpperCase();
  return cleanId.length <= 10 ? cleanId : cleanId.slice(0, 10);
}

export const CANONICAL_CSL_STYLE_IDS = [
  'apa-7th',
  'ieee',
  'mla-9th',
  'chicago-author-date',
  'harvard',
  'vancouver',
  'nature',
  'tcvn',
  'bibtex',
  'ris',
] as const;

export type CanonicalCitationStyleId = (typeof CANONICAL_CSL_STYLE_IDS)[number];

export const CORE_CITATION_STYLES = [
  { id: 'apa-7th', label: 'APA (7th Edition)', shortLabel: 'APA' },
  { id: 'ieee', label: 'IEEE Style', shortLabel: 'IEEE' },
  { id: 'mla-9th', label: 'MLA (9th Edition)', shortLabel: 'MLA' },
  { id: 'chicago-author-date', label: 'Chicago (Author-Date)', shortLabel: 'Chicago' },
  { id: 'nature', label: 'Nature', shortLabel: 'Nature' },
  { id: 'harvard', label: 'Harvard', shortLabel: 'Harvard' },
  { id: 'vancouver', label: 'Vancouver', shortLabel: 'Vancouver' },
  { id: 'tcvn', label: 'TCVN (Tiêu chuẩn Việt Nam)', shortLabel: 'TCVN' },
  { id: 'bibtex', label: 'BibTeX', shortLabel: 'BibTeX' },
  { id: 'ris', label: 'RIS', shortLabel: 'RIS' },
] as const;

export const DEFAULT_CITATION_STYLES = CORE_CITATION_STYLES.slice(0, 8);

const CITATION_STYLE_ALIAS_MAP: Readonly<Record<string, string>> = {
  apa: 'apa-7th',
  'apa-7': 'apa-7th',
  'apa-7th': 'apa-7th',
  mla: 'mla-9th',
  'mla-9': 'mla-9th',
  'mla-9th': 'mla-9th',
  chicago: 'chicago-author-date',
  'chicago-author-date': 'chicago-author-date',
  harvard: 'harvard',
  harvard1: 'harvard',
  ieee: 'ieee',
  vancouver: 'vancouver',
  nature: 'nature',
  tcvn: 'tcvn',
  'tcvn-author-date': 'tcvn',
  bibtex: 'bibtex',
  ris: 'ris',
};

/**
 * Normalizes legacy or shorthand citation style identifiers (e.g. `'apa'`, `'mla'`, `'chicago'`, `'harvard1'`)
 * into their canonical style ID (`'apa-7th'`, `'mla-9th'`, `'chicago-author-date'`, `'harvard'`, etc.).
 */
export function normalizeCitationStyleId(styleId?: string | null): CslStyle {
  if (!styleId || typeof styleId !== 'string') return 'apa-7th';
  const cleaned = styleId.trim().toLowerCase();
  if (!cleaned) return 'apa-7th';
  return CITATION_STYLE_ALIAS_MAP[cleaned] ?? styleId.trim();
}

/**
 * Formats a StyleSummary or style object into a standardized, human-friendly
 * citation style label for dropdown menus and pickers.
 */
export function formatCitationStyleLabel(style: {
  id: string;
  name?: string;
  shortTitle?: string;
} | string): string {
  const rawId = typeof style === 'string' ? style : style.id;
  const id = (rawId || '').toLowerCase().trim();
  if (id === 'apa-7th' || id === 'apa') return 'APA (7th Edition)';
  if (id === 'mla-9th' || id === 'mla') return 'MLA (9th Edition)';
  if (id === 'ieee') return 'IEEE Style';
  if (id === 'chicago' || id === 'chicago-author-date') return 'Chicago (Author-Date)';
  if (id === 'harvard' || id === 'harvard1') return 'Harvard';
  if (id === 'nature') return 'Nature';
  if (id === 'vancouver') return 'Vancouver';
  if (id === 'tcvn' || id === 'tcvn-author-date') return 'TCVN (Tiêu chuẩn Việt Nam)';
  if (id === 'tcvn-numeric') return 'TCVN (Đánh số)';

  if (typeof style === 'object' && style !== null) {
    return style.shortTitle || style.name || style.id;
  }
  return rawId;
}
