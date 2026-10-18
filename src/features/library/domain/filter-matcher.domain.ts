/**
 * Pure diacritic-insensitive matcher, scoring, and type alias matching
 */

import { foldDiacritics } from './academic-text';

export const KNOWN_TYPE_ALIASES: Record<string, string[]> = {
  journalarticle: ['article', 'paper', 'journal', 'bai bao'],
  book: ['sach', 'volume', 'monograph'],
  conferencepaper: ['proceeding', 'hoi nghi', 'hoi thao'],
  thesis: ['luan an', 'luan van', 'dissertation'],
  preprint: ['ban thao', 'arxiv', 'prprnt'],
  report: ['bao cao'],
  webpage: ['trang web', 'website'],
};

const NON_WORD_WHITESPACE_RE = /[^\w\s]/gi;
const MULTI_WHITESPACE_RE = /\s+/g;
const CAMEL_CASE_BOUNDARY_RE = /([A-Z])/g;
const HYPHEN_UNDERSCORE_RE = /[-_]/g;
const FIRST_CHAR_RE = /^./;

const NORMALIZE_CACHE_LIMIT = 512;
const normalizeSearchCache = new Map<string, string>();

export function normalizeSearchStr(str: string): string {
  if (!str) return '';
  const cached = normalizeSearchCache.get(str);
  if (cached !== undefined) return cached;

  const normalized = foldDiacritics(str)
    .replace(NON_WORD_WHITESPACE_RE, ' ')
    .replace(MULTI_WHITESPACE_RE, ' ')
    .trim();

  if (normalizeSearchCache.size >= NORMALIZE_CACHE_LIMIT) {
    normalizeSearchCache.clear();
  }
  normalizeSearchCache.set(str, normalized);
  return normalized;
}

export function formatTypeFallback(type: string): string {
  if (!type) return '';
  return type
    .replace(CAMEL_CASE_BOUNDARY_RE, ' $1')
    .replace(HYPHEN_UNDERSCORE_RE, ' ')
    .replace(FIRST_CHAR_RE, (s) => s.toUpperCase())
    .trim();
}

export function calculateFilterMatchScore(
  text: string,
  query: string,
  aliases: string[] = []
): { matches: boolean; score: number } {
  if (!query) return { matches: true, score: 100 };
  const normQuery = normalizeSearchStr(query);
  if (!normQuery) return { matches: false, score: 0 };

  const normText = normalizeSearchStr(text);
  if (!normText) return { matches: false, score: 0 };

  if (normText === normQuery) return { matches: true, score: 100 };
  if (normText.startsWith(normQuery)) return { matches: true, score: 90 };
  if (normText.includes(normQuery)) return { matches: true, score: 85 };

  // Alias match (leverages memoized normalizeSearchStr)
  for (let i = 0; i < aliases.length; i++) {
    const normAlias = normalizeSearchStr(aliases[i]);
    if (normAlias && (normText.includes(normAlias) || normAlias.includes(normQuery))) {
      return { matches: true, score: 85 };
    }
  }

  // Fuzzy subsequence matching (only reachable if normText.length >= normQuery.length)
  if (normText.length >= normQuery.length) {
    let tIdx = 0;
    let qIdx = 0;
    while (tIdx < normText.length && qIdx < normQuery.length) {
      if (normText.charCodeAt(tIdx) === normQuery.charCodeAt(qIdx)) {
        qIdx++;
      }
      tIdx++;
    }
    if (qIdx === normQuery.length) {
      return { matches: true, score: 60 };
    }
  }

  return { matches: false, score: 0 };
}
