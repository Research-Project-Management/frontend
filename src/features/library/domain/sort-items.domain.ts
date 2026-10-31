/**
 * Client-Side Sort & Diacritic-Insensitive Filter Matcher for Library Items
 */

import type { Item } from '@/features/library/domain/types/core.types';
import { isValidValue, stripLatexMarkup } from './metadata-sanitizers';
import {
  getPublicationVenue,
  getItemDisplayTitle,
  getItemDisplayDate,
} from './metadata-extra';
import { parseCreatorName } from './creators';
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

const NON_WORD_WHITESPACE_RE = /[^\p{L}\p{N}\s]/gu;
const MULTI_WHITESPACE_RE = /\s+/g;
const CAMEL_CASE_BOUNDARY_RE = /([A-Z])/g;
const HYPHEN_UNDERSCORE_RE = /[-_]/g;
const FIRST_CHAR_RE = /^./;

const NORMALIZE_CACHE_LIMIT = 512;
const normalizeSearchCache = new Map<string, string>();

export function normalizeSearchStr(str: string): string {
  if (!str) return '';
  const cached = normalizeSearchCache.get(str);
  if (cached !== undefined) {
    normalizeSearchCache.delete(str);
    normalizeSearchCache.set(str, cached);
    return cached;
  }

  const normalized = foldDiacritics(str)
    .replace(NON_WORD_WHITESPACE_RE, ' ')
    .replace(MULTI_WHITESPACE_RE, ' ')
    .trim();

  if (normalizeSearchCache.size >= NORMALIZE_CACHE_LIMIT) {
    const oldest = normalizeSearchCache.keys().next().value;
    if (oldest !== undefined) {
      normalizeSearchCache.delete(oldest);
    }
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
  aliases: string[] = [],
): { matches: boolean; score: number } {
  if (!query) return { matches: true, score: 100 };
  const normQuery = normalizeSearchStr(query);
  if (!normQuery) return { matches: false, score: 0 };

  const normText = normalizeSearchStr(text);
  if (!normText) return { matches: false, score: 0 };

  if (normText === normQuery) return { matches: true, score: 100 };
  if (normText.startsWith(normQuery)) return { matches: true, score: 90 };
  if (normText.includes(normQuery)) return { matches: true, score: 85 };

  for (let i = 0; i < aliases.length; i++) {
    const normAlias = normalizeSearchStr(aliases[i]);
    if (normAlias && (normText.includes(normAlias) || normAlias.includes(normQuery))) {
      return { matches: true, score: 85 };
    }
  }

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

// ── Client-Side Sort Engine ─────────────────────────────────────────────────

const FOUR_DIGIT_YEAR_RE = /\b(1[4-9]\d{2}|20\d{2}|2100)\b/;

function extractFallbackYear(item: Item): number | null {
  const candidates: unknown[] = [
    item.publicationDate,
    item.date,
    item.issueDate,
    getItemDisplayDate(item),
  ];
  for (const cand of candidates) {
    if (typeof cand === 'string' && isValidValue(cand)) {
      const m = FOUR_DIGIT_YEAR_RE.exec(cand);
      if (m) {
        const num = Number(m[1]);
        if (!Number.isNaN(num) && num > 0) return num;
      }
    }
  }
  return null;
}

function extractSortableAuthor(item: Item): string | null {
  if (Array.isArray(item.creators) && item.creators.length > 0) {
    const first = item.creators[0];
    if (first) {
      if (first.fieldMode === 1) {
        const inst = first.lastName || first.fullName || first.name || '';
        if (isValidValue(inst)) return stripLatexMarkup(inst);
      }
      if (isValidValue(first.lastName)) {
        const firstPart = isValidValue(first.firstName) ? ` ${first.firstName}` : '';
        return stripLatexMarkup(`${first.lastName}${firstPart}`.trim());
      }
      const rawFull = first.fullName || first.name || '';
      if (isValidValue(rawFull)) {
        const parsed = parseCreatorName(rawFull);
        if (parsed.isInstitution) {
          return stripLatexMarkup(parsed.fullName || parsed.lastName);
        }
        const firstPart = parsed.firstName ? ` ${parsed.firstName}` : '';
        return stripLatexMarkup(`${parsed.lastName || parsed.fullName}${firstPart}`.trim());
      }
    }
  }
  if (Array.isArray(item.authors) && item.authors.length > 0) {
    const first = item.authors[0];
    if (typeof first === 'string' && isValidValue(first)) {
      const commaIdx = first.indexOf(',');
      if (commaIdx > 0 && !first.includes('\\') && !first.includes('{')) {
        const last = first.slice(0, commaIdx).trim();
        const firstPart = first.slice(commaIdx + 1).trim();
        return firstPart ? `${last} ${firstPart}` : last;
      }
      const parsed = parseCreatorName(first);
      if (parsed.isInstitution) return parsed.fullName || parsed.lastName;
      const firstPart = parsed.firstName ? ` ${parsed.firstName}` : '';
      return `${parsed.lastName || parsed.fullName}${firstPart}`.trim();
    }
    if (typeof first === 'object' && first !== null) {
      const obj = first as Record<string, unknown>;
      const last = String(obj.lastName || obj.family || '');
      const given = String(obj.firstName || obj.given || '');
      if (isValidValue(last)) {
        return stripLatexMarkup(isValidValue(given) ? `${last} ${given}`.trim() : last);
      }
      const rawFull = String(obj.name || obj.fullName || '');
      if (isValidValue(rawFull)) {
        const parsed = parseCreatorName(rawFull);
        if (parsed.isInstitution) return stripLatexMarkup(parsed.fullName || parsed.lastName);
        const firstPart = parsed.firstName ? ` ${parsed.firstName}` : '';
        return stripLatexMarkup(`${parsed.lastName || parsed.fullName}${firstPart}`.trim());
      }
    }
  }
  if (typeof item.firstAuthor === 'string' && isValidValue(item.firstAuthor)) {
    const parsed = parseCreatorName(item.firstAuthor);
    if (parsed.isInstitution) return parsed.fullName || parsed.lastName;
    const firstPart = parsed.firstName ? ` ${parsed.firstName}` : '';
    return `${parsed.lastName || parsed.fullName}${firstPart}`.trim();
  }
  return null;
}

const LEADING_PUNCTUATION_RE = /^[\s"'“”‘’«»[\]()<>]+/;
const VIETNAMESE_D_RE = /[Đđ]/g;

function normalizeSortString(raw: string): string {
  return stripLatexMarkup(raw)
    .replace(LEADING_PUNCTUATION_RE, '')
    .replace(VIETNAMESE_D_RE, (m) => (m === 'Đ' ? 'D' : 'd'))
    .trim();
}

const SORT_FIELD_ALIASES: Partial<Record<string, (item: Item) => unknown>> = {
  authors: (item) => extractSortableAuthor(item),
  title: (item) => {
    const displayTitle = getItemDisplayTitle(item);
    if (displayTitle && isValidValue(displayTitle)) return displayTitle;
    return item.title && isValidValue(item.title) ? item.title : null;
  },
  year: (item) => {
    const y = item.year;
    if (isValidValue(y)) {
      const num = Number(y);
      if (!isNaN(num) && num > 0) return num;
    }
    return extractFallbackYear(item);
  },
  dateAdded: (item) => item.createdAt,
  dateModified: (item) => item.updatedAt,
  dateDeleted: (item) => item.deletedAt,
  deletedAt: (item) => item.deletedAt,
  publication: (item) => getPublicationVenue(item) || null,
  publicationTitle: (item) => getPublicationVenue(item) || null,
};

function getValue(item: Item, column: string): unknown {
  const alias = SORT_FIELD_ALIASES[column];
  if (alias) return alias(item);
  return Reflect.get(item, column);
}

const SORT_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

interface PreparedSortKey {
  item: Item;
  isEmpty: boolean;
  strVal: string | null;
  numVal: number;
}

const DATE_COLUMNS = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'dateAdded',
  'dateModified',
  'dateDeleted',
]);

function prepareSortKey(item: Item, column: string, isDateColumn: boolean): PreparedSortKey {
  const raw = getValue(item, column);
  const isEmpty =
    !isValidValue(raw) || (typeof raw === 'number' && (Number.isNaN(raw) || raw === 0));
  if (isEmpty) {
    return { item, isEmpty: true, strVal: null, numVal: 0 };
  }
  if (isDateColumn && typeof raw === 'string') {
    const ts = Date.parse(raw);
    if (!Number.isNaN(ts)) {
      return {
        item,
        isEmpty: false,
        strVal: null,
        numVal: ts,
      };
    }
  }
  if (typeof raw === 'string') {
    return {
      item,
      isEmpty: false,
      strVal: normalizeSortString(raw),
      numVal: 0,
    };
  }
  return {
    item,
    isEmpty: false,
    strVal: null,
    numVal: Number(raw),
  };
}

/**
 * Sort library items client-side using a Schwartzian transform (decorate-sort-undecorate)
 * so LaTeX stripping, creator parsing, and string normalization happen O(N) times instead of O(N log N).
 */
export function sortLibraryItems(
  items: Item[],
  column: string | null,
  direction: 'asc' | 'desc' = 'asc',
  serverSorted = false,
): Item[] {
  if (items.length <= 1) return items;

  if (serverSorted || !column) {
    let hasProcessing = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i]._isProcessing) {
        hasProcessing = true;
        break;
      }
    }
    if (!hasProcessing) return items;
  }

  const processing: Item[] = [];
  const regular: Item[] = [];

  for (const item of items) {
    if (item._isProcessing) {
      processing.push(item);
    } else {
      regular.push(item);
    }
  }

  if (serverSorted || !column) {
    return processing.length > 0 ? [...processing, ...regular] : regular;
  }

  const isDateColumn = DATE_COLUMNS.has(column);
  const decorated = regular.map((item) => prepareSortKey(item, column, isDateColumn));
  decorated.sort((a, b) => {
    if (a.isEmpty && b.isEmpty) return 0;
    if (a.isEmpty) return 1;
    if (b.isEmpty) return -1;

    if (a.strVal !== null && b.strVal !== null) {
      const cmp = SORT_COLLATOR.compare(a.strVal, b.strVal);
      return direction === 'asc' ? cmp : -cmp;
    }

    if (a.numVal < b.numVal) return direction === 'asc' ? -1 : 1;
    if (a.numVal > b.numVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedRegular = decorated.map((d) => d.item);
  return processing.length > 0 ? [...processing, ...sortedRegular] : sortedRegular;
}
