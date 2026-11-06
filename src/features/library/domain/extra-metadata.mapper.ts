import type { Item } from '@/features/library/domain/types/core.types';
import { isValidValue, stripLatexMarkup, foldDiacritics } from '@/features/library/domain/metadata-sanitizers.domain';
import { ALLOWED_ITEM_EXTRA_LINE_KEYS, SYSTEM_INTERNAL_METADATA_KEYS, INTERNAL_AND_DEDICATED_METADATA_KEYS, DEDICATED_FIELDS_BY_TYPE_MAP, EMPTY_DEDICATED_FIELDS_SET, EXTRA_KEY_ALIASES, getMatchingExtraKeyNorms, collectUnmappedFieldsSet, isDedicatedFieldForType, getPublicationVenue, getItemDisplayTitle, getItemDisplayDate } from './metadata-extra.constants';
import { parseCreatorName } from '@/features/library/domain/creators.domain';

export function isSystemInternalExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith('_')) return true;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  return SYSTEM_INTERNAL_METADATA_KEYS.has(normalized);
}

export function isAllowedItemExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith('_')) return false;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  return !INTERNAL_AND_DEDICATED_METADATA_KEYS.has(normalized);
}

/**
 * Formats the extra metadata field for inspector display.
 */
export function formatExtraDisplay(item: Item): string {
  const sanitized = formatAndSanitizeExtraMetadata(
    item.extra,
    item.extraFields as Record<string, unknown> | undefined,
    item,
  );
  if (sanitized) {
    return sanitized.replace(/\r?\n+/g, ', ');
  }
  return '—';
}

/**
 * Formats and cleans extra metadata text for the Inspector's Extra tab.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  const lines: string[] = [];
  const seenNormalizedLines = new Set<string>();

  const effectiveExtraFields =
    additionalExtraFields ||
    (associatedPaperItem?.extraFields as Record<string, unknown> | undefined);

  const resolvedItemType =
    (typeof associatedPaperItem?.itemType === 'string' &&
      associatedPaperItem.itemType) ||
    (typeof effectiveExtraFields?.itemType === 'string' &&
      effectiveExtraFields.itemType) ||
    undefined;

  const dedicatedFieldsForType: ReadonlySet<string> =
    (resolvedItemType && DEDICATED_FIELDS_BY_TYPE_MAP.get(resolvedItemType)) ||
    EMPTY_DEDICATED_FIELDS_SET;
  const unmappedFields = collectUnmappedFieldsSet(
    associatedPaperItem,
    additionalExtraFields,
  );

  const isDedicatedFieldOnCurrentType = (rawKey: string): boolean => {
    return isDedicatedFieldForType(
      rawKey,
      dedicatedFieldsForType,
      unmappedFields,
    );
  };

  const canRenderExtraFieldKey = (
    rawKey: string,
    fromExplicitExtraText: boolean,
  ): boolean => {
    const trimmedKey = rawKey.trim();
    if (!trimmedKey) return false;
    const normKey = trimmedKey.toLowerCase().replace(/[\s_-]+/g, '');
    if (unmappedFields.has(normKey)) {
      return true;
    }
    if (isSystemInternalExtraKey(trimmedKey)) return false;
    if (isDedicatedFieldOnCurrentType(trimmedKey)) {
      return false;
    }
    if (ALLOWED_ITEM_EXTRA_LINE_KEYS.has(normKey)) {
      return true;
    }
    if (resolvedItemType && fromExplicitExtraText) {
      return true;
    }
    return isAllowedItemExtraKey(trimmedKey);
  };

  const pushUniqueLine = (rawLine: string, fromExplicitExtraText = true) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const key = kvMatch[1]!.trim();
      const val = kvMatch[2]!.trim();
      if (
        !canRenderExtraFieldKey(key, fromExplicitExtraText) ||
        (!isValidValue(val) && val !== '0') ||
        val === '[object Object]'
      ) {
        return;
      }
    }
    const norm = trimmed
      .toLowerCase()
      .replace(/\s*:\s*/g, ': ')
      .replace(/\s+/g, ' ');
    if (!seenNormalizedLines.has(norm)) {
      seenNormalizedLines.add(norm);
      lines.push(trimmed);
    }
  };

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith('{') && !trimmed.startsWith('{:')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const parsedObj = parsed as Record<string, unknown>;
          if (
            typeof parsedObj._rawExtra === 'string' &&
            parsedObj._rawExtra.trim()
          ) {
            for (const l of parsedObj._rawExtra.split(/\r?\n/)) {
              pushUniqueLine(l, true);
            }
          }
          for (const [k, v] of Object.entries(parsedObj)) {
            if (k === '_rawExtra' || !canRenderExtraFieldKey(k, false)) {
              continue;
            }
            if (
              (typeof v === 'string' || typeof v === 'number') &&
              (isValidValue(v) || v === 0 || v === '0')
            ) {
              pushUniqueLine(`${k}: ${String(v).trim()}`, false);
            }
          }
        }
      } catch {
        for (const l of trimmed.split(/\r?\n/)) {
          pushUniqueLine(l, true);
        }
      }
    } else {
      for (const l of trimmed.split(/\r?\n/)) {
        pushUniqueLine(l, true);
      }
    }
  }

  if (effectiveExtraFields && typeof effectiveExtraFields === 'object') {
    for (const [k, v] of Object.entries(effectiveExtraFields)) {
      if (!canRenderExtraFieldKey(k, false)) {
        continue;
      }
      if (
        (typeof v === 'string' || typeof v === 'number') &&
        (isValidValue(v) || v === 0 || v === '0')
      ) {
        pushUniqueLine(`${k}: ${String(v).trim()}`, false);
      }
    }
  }

  return lines.join('\n').trim();
}

/**
 * Strips or updates in-place any `Key: Value` line or `{:Key: Value}` block in `extraText`
 * matching `canonicalKey` (including its `EXTRA_KEY_ALIASES` such as `DOI`, `PMID`, `PMCID`,
 * `arXiv`, `Original Date`, `Citation Key`). Returns `undefined` if `extraText` did not
 * contain a matching entry so callers only patch `item.extra` when necessary.
 */
export function stripOrUpdateExtraKeyLine(
  extraText: string | null | undefined,
  canonicalKey: string,
  newValue: string,
): string | undefined {
  if (typeof extraText !== 'string' || !extraText.trim()) return undefined;
  const matchingNorms = getMatchingExtraKeyNorms(canonicalKey);
  if (matchingNorms.size === 0) return undefined;

  const cleanNewVal = newValue.trim();
  let mutated = false;
  const nextLines: string[] = [];

  for (const rawLine of extraText.split(/\r?\n/)) {
    let workingLine = rawLine;
    if (workingLine.includes('{:')) {
      workingLine = workingLine.replace(
        /\{:([^:}]+):\s*([^}]+)\}/g,
        (fullMatch, rawKey: string, rawVal: string) => {
          const norm = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (!matchingNorms.has(norm)) return fullMatch;
          if (!cleanNewVal) {
            mutated = true;
            return '';
          }
          if (rawVal.trim() !== cleanNewVal) {
            mutated = true;
          }
          return `{:${rawKey.trim()}: ${cleanNewVal}}`;
        },
      );
    }

    const trimmed = workingLine.trim();
    if (!trimmed) {
      if (rawLine.trim()) mutated = true;
      continue;
    }

    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const lineKey = kvMatch[1]!.trim();
      const lineVal = kvMatch[2]!.trim();
      const lineNorm = lineKey.toLowerCase().replace(/[\s_-]+/g, '');
      if (matchingNorms.has(lineNorm)) {
        if (!cleanNewVal) {
          mutated = true;
          continue;
        }
        if (lineVal !== cleanNewVal) {
          mutated = true;
        }
        nextLines.push(`${lineKey}: ${cleanNewVal}`);
        continue;
      }
    }

    nextLines.push(workingLine);
  }

  return mutated ? nextLines.join('\n').trim() : undefined;
}

export function extractNormalizedExtraLines(
  text?: string | null,
): Map<string, { rawKey: string; value: string }> {
  const map = new Map<string, { rawKey: string; value: string }>();
  if (typeof text !== 'string' || !text.trim()) return map;
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const rawKey = kvMatch[1]!.trim();
      const value = kvMatch[2]!.trim();
      const norm = rawKey.toLowerCase().replace(/[\s_-]+/g, '');
      if (norm && !isSystemInternalExtraKey(rawKey)) {
        map.set(norm, { rawKey, value });
      }
    }
  }
  return map;
}

const PARSED_EXTRA_STRING_CACHE = new Map<string, Readonly<Record<string, string>>>();
const PARSED_EXTRA_OBJECT_CACHE = new WeakMap<object, Readonly<Record<string, string>>>();
const MAX_EXTRA_CACHE_SIZE = 5000;

/**
 * Parses item "Extra" field extended syntax (both `Key: Value` lines and `{:Key: Value}` blocks)
 * into a dictionary supporting both exact, lowercase, and canonical field lookups.
 */
export function parseItemExtraField(extra?: unknown): Record<string, string> {
  if (!extra) return {};

  if (typeof extra === 'string') {
    const trimmed = extra.trim();
    if (!trimmed) return {};
    const cached = PARSED_EXTRA_STRING_CACHE.get(trimmed);
    if (cached) {
      PARSED_EXTRA_STRING_CACHE.delete(trimmed);
      PARSED_EXTRA_STRING_CACHE.set(trimmed, cached);
      return cached;
    }
  } else if (typeof extra === 'object' && !Array.isArray(extra)) {
    const cached = PARSED_EXTRA_OBJECT_CACHE.get(extra);
    if (cached) return cached;
  }

  const result: Record<string, string> = {};
  const setKey = (rawKey: string, rawVal: string) => {
    const k = rawKey.trim();
    const v = rawVal.trim();
    if (!k || !isValidValue(v)) return;
    result[k] = v;
    const lower = k.toLowerCase();
    result[lower] = v;
    const collapsed = lower.replace(/[\s_-]+/g, '');
    result[collapsed] = v;
    const aliases = EXTRA_KEY_ALIASES[collapsed];
    if (aliases) {
      for (const alias of aliases) {
        if (!result[alias]) result[alias] = v;
        if (!result[alias.toLowerCase()]) result[alias.toLowerCase()] = v;
      }
    }
  };

  if (typeof extra === 'object' && !Array.isArray(extra)) {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      if (v !== null && v !== undefined && isValidValue(v)) {
        setKey(k, String(v));
      }
    }
    const frozen = Object.freeze(result);
    PARSED_EXTRA_OBJECT_CACHE.set(extra, frozen);
    return frozen;
  }

  if (typeof extra !== 'string') return result;
  const trimmed = extra.trim();
  if (!trimmed) return result;

  const cacheAndReturn = (res: Record<string, string>): Readonly<Record<string, string>> => {
    const frozen = Object.freeze(res);
    if (PARSED_EXTRA_STRING_CACHE.size >= MAX_EXTRA_CACHE_SIZE) {
      const oldest = PARSED_EXTRA_STRING_CACHE.keys().next().value;
      if (oldest !== undefined) {
        PARSED_EXTRA_STRING_CACHE.delete(oldest);
      }
    }
    PARSED_EXTRA_STRING_CACHE.set(trimmed, frozen);
    return frozen;
  };

  if (trimmed.startsWith('{') && !trimmed.startsWith('{:')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (v !== null && v !== undefined && isValidValue(v)) {
            setKey(k, String(v));
          }
        }
        return cacheAndReturn(result);
      }
    } catch {
      // Fall through to line-by-line Extra field parsing
    }
  }

  const inlineRegex = /\{:([^:}]+):\s*([^}]+)\}/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(trimmed)) !== null) {
    setKey(inlineMatch[1], inlineMatch[2]);
  }

  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/\{:[^:}]+:[^}]+\}/g, '').trim();
    if (!cleanLine) continue;
    const match = cleanLine.match(
      /^([A-Za-z][A-Za-z0-9\s_-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (match) {
      setKey(match[1], match[2]);
    }
  }

  return cacheAndReturn(result);
}

/**
 * Client-Side Sort & Diacritic-Insensitive Filter Matcher for Library Items
 */

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

  if (serverSorted || !column || column === 'relevance') {
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

  if (serverSorted || !column || column === 'relevance') {
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
