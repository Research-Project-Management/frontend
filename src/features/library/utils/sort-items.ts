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

import type { Item } from '../types/library.types';

// Fields that map to different internal property names
const SORT_FIELD_ALIASES: Partial<Record<string, (item: Item) => unknown>> = {
  authors: (item) => (Array.isArray(item.authors) ? item.authors[0] : item.authors),
  dateAdded: (item) => item.createdAt,
  dateModified: (item) => item.updatedAt,
};

function getValue(item: Item, column: string): unknown {
  const alias = SORT_FIELD_ALIASES[column];
  if (alias) return alias(item);
  return (item as unknown as Record<string, unknown>)[column];
}

function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  // Nullish values sort last regardless of direction
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === 'string' && typeof b === 'string') {
    const cmp = a.localeCompare(b);
    return direction === 'asc' ? cmp : -cmp;
  }

  const numA = Number(a);
  const numB = Number(b);
  if (numA < numB) return direction === 'asc' ? -1 : 1;
  if (numA > numB) return direction === 'asc' ? 1 : -1;
  return 0;
}

/**
 * Sort library items client-side.
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
  const processing = items.filter((it) => (it as { _isProcessing?: boolean })._isProcessing);
  const regular = items.filter((it) => !(it as { _isProcessing?: boolean })._isProcessing);

  if (serverSorted || !column) {
    return [...processing, ...regular];
  }

  const sorted = [...regular].sort((a, b) =>
    compareValues(getValue(a, column), getValue(b, column), direction),
  );

  return [...processing, ...sorted];
}
