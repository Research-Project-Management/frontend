/**
 * Client-Side Sort Utility for Library Items
 *
 * Pure function extracted from ItemTable's `useMemo` sort block.
 * Applies only when server-side sorting (onSortChange) is not active.
 *
 * Strategy:
 * - Processing items (_isProcessing) are always pinned to the top.
 * - Regular items are sorted by the given column and direction.
 * - Handles field aliases: authors → first author, dateAdded → createdAt, dateModified → updatedAt.
 * - Nulls/undefined sort to the bottom regardless of direction.
 */

import type { Item } from '@/features/library/domain/types/library.types';
import { isValidValue, stripLatexMarkup, getPublicationVenue } from '@/features/library/domain/metadata';
import { parseCreatorName } from '@/features/library/domain/creators';

function extractSortableAuthor(item: Item): string | null {
  if (Array.isArray(item.authors) && item.authors.length > 0) {
    const first = item.authors[0];
    if (typeof first === 'string' && isValidValue(first)) {
      const commaIdx = first.indexOf(',');
      if (commaIdx > 0 && !first.includes('\\') && !first.includes('{')) {
        return first.slice(0, commaIdx).trim();
      }
      const parsed = parseCreatorName(first);
      return parsed.lastName || parsed.fullName;
    }
    if (typeof first === 'object' && first !== null) {
      const obj = first as Record<string, unknown>;
      const name = String(obj.lastName || obj.family || obj.name || obj.fullName || '');
      if (isValidValue(name)) return stripLatexMarkup(name);
    }
  }
  if (Array.isArray(item.creators) && item.creators.length > 0) {
    const first = item.creators[0];
    if (first) {
      const last = first.lastName || first.name || first.fullName || '';
      if (isValidValue(last)) return stripLatexMarkup(last);
    }
  }
  if (typeof item.firstAuthor === 'string' && isValidValue(item.firstAuthor)) {
    const parsed = parseCreatorName(item.firstAuthor);
    return parsed.lastName || parsed.fullName;
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

// Fields that map to different internal property names
const SORT_FIELD_ALIASES: Partial<Record<string, (item: Item) => unknown>> = {
  authors: (item) => extractSortableAuthor(item),
  title: (item) => (item.title && isValidValue(item.title) ? item.title : null),
  year: (item) => {
    const y = item.year;
    if (!isValidValue(y)) return null;
    const num = Number(y);
    return !isNaN(num) && num > 0 ? num : null;
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
 *
 * @param items        - The full item list from the server.
 * @param column       - The sort column key (matches Item field or alias).
 * @param direction    - 'asc' | 'desc'
 * @param serverSorted - When true (i.e. onSortChange is present), skip client sort
 *                       and only pin processing items to the top.
 */
export function sortLibraryItems(
  items: Item[],
  column: string | null,
  direction: 'asc' | 'desc',
  serverSorted: boolean,
): Item[] {
  if (items.length <= 1) return items;

  // Fast-path for serverSorted when no items are currently processing: preserve array reference!
  if (serverSorted || !column) {
    let hasProcessing = false;
    for (let i = 0; i < items.length; i++) {
      if ((items[i] as { _isProcessing?: boolean })._isProcessing) {
        hasProcessing = true;
        break;
      }
    }
    if (!hasProcessing) return items;
  }

  const processing: Item[] = [];
  const regular: Item[] = [];

  for (const item of items) {
    if ((item as { _isProcessing?: boolean })._isProcessing) {
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
    // Nullish or dirty placeholder values sort last regardless of direction
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

