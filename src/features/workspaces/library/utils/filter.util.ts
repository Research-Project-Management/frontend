import type { CatalogItem } from '../types/library.types';
import { filterItems } from './library.util';

export interface FilterItemsOptions {
  items: CatalogItem[];
  searchQuery?: string;
  activeFilter?: string | null;
  activeTag?: string | null;
  activeCollectionId?: string | null;
  collectionIds?: Set<string>;
  duplicateItemIds?: Set<string>;
}

export type FilterPapersOptions = FilterItemsOptions;

/**
 * Calculates a Set of collection IDs including the target collection and all its recursive descendants.
 */
export function getDescendantIds(
  collectionId: string,
  collections: { id: string; parentId?: string | null }[],
): Set<string> {
  const result = new Set<string>([collectionId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of collections) {
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        added = true;
      }
    }
  }
  return result;
}

/**
 * Calculates a Set of Item IDs that are duplicate candidates based on matching DOI or normalized Title.
 */
export function getDuplicateIds(items: CatalogItem[]): Set<string> {
  const doiMap = new Map<string, string[]>();
  const titleMap = new Map<string, string[]>();

  for (const item of items) {
    if (item.deletedAt) continue;
    const itemId = item.id;

    if (item.doi && item.doi.trim()) {
      const normDoi = item.doi.trim().toLowerCase();
      const group = doiMap.get(normDoi) || [];
      doiMap.set(normDoi, [...group, itemId]);
    }

    if (item.title && item.title.trim()) {
      const normTitle = item.title.trim().toLowerCase();
      const group = titleMap.get(normTitle) || [];
      titleMap.set(normTitle, [...group, itemId]);
    }
  }

  const duplicates = new Set<string>();

  for (const ids of doiMap.values()) {
    if (ids.length > 1) {
      for (const id of ids) duplicates.add(id);
    }
  }

  for (const ids of titleMap.values()) {
    if (ids.length > 1) {
      for (const id of ids) duplicates.add(id);
    }
  }

  return duplicates;
}

/**
 * Filters and sorts library items based on active filter, collection, tag, search query, and duplicates.
 */
export function sortFilterItems({
  items,
  searchQuery = '',
  activeFilter = null,
  activeTag = null,
  activeCollectionId = null,
  collectionIds,
  duplicateItemIds = new Set<string>(),
}: FilterItemsOptions): CatalogItem[] {
  let result = items;

  // 1. Filter out trash unless currently viewing the Trash view
  if (activeFilter === 'trash') {
    result = result.filter((item) => Boolean(item.deletedAt));
  } else {
    result = result.filter((item) => !item.deletedAt);
  }

  // 2. Filter by Collection if activeCollectionId is provided
  if (activeCollectionId) {
    if (collectionIds && collectionIds.size > 0) {
      result = result.filter(
        (item) => item.collectionId && collectionIds.has(item.collectionId),
      );
    } else {
      result = result.filter(
        (item) => item.collectionId === activeCollectionId,
      );
    }
  }

  // 3. Apply smart view filters
  if (activeFilter === 'recent-read') {
    const accessed = result.filter((item) => Boolean(item.accessedAt));
    if (accessed.length > 0) {
      result = accessed.sort(
        (a, b) => new Date(b.accessedAt || 0).getTime() - new Date(a.accessedAt || 0).getTime(),
      );
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    }
  } else if (activeFilter === 'unfiled') {
    result = result.filter((item) => !item.collectionId);
  } else if (activeFilter === 'duplicates') {
    result = result.filter((item) => duplicateItemIds.has(item.id));
  }

  // 4. Apply tag filter
  if (activeTag) {
    result = result.filter((item) => item.labels?.includes(activeTag));
  }

  // 5. Apply search keyword query
  if (searchQuery.trim()) {
    result = filterItems(result, searchQuery);
  }

  return result;
}

// ── Consolidated Smart View Utilities ────────────────────────────────────────

const TRASH_RETENTION_DAYS = 30;

/**
 * Calculates remaining days before a trashed item is automatically purged.
 */
export function getDaysUntilPurge(deletedAt?: string | null): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const deletedTime = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsedDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays);
}

/**
 * Checks if a trashed item has exceeded the 30-day retention window.
 */
export function isExpiredTrash(deletedAt?: string | null): boolean {
  return getDaysUntilPurge(deletedAt) === 0;
}

/**
 * Filters items marked as in trash.
 */
export function filterTrash(items: CatalogItem[]): CatalogItem[] {
  return items.filter((p) => Boolean(p.deletedAt || (p as any).isTrash || (p as any).isInTrash));
}

/**
 * Checks if an item is unfiled (not assigned to any collection).
 */
export function isUnfiled(item: CatalogItem): boolean {
  if (item.deletedAt || (item as any).isTrash || (item as any).isInTrash) return false;
  if (item.collectionId) return false;
  const p = item as any;
  if (Array.isArray(p.collections) && p.collections.length > 0) return false;
  if (Array.isArray(p.collectionIds) && p.collectionIds.length > 0) return false;
  return true;
}

/**
 * Filters items that are not assigned to any collection.
 */
export function filterUnfiled(items: CatalogItem[]): CatalogItem[] {
  return items.filter(isUnfiled);
}

/**
 * Groups recently accessed items into temporal buckets (Today, Yesterday, This Week, Earlier).
 */
export function groupByTime(items: CatalogItem[]): {
  today: CatalogItem[];
  yesterday: CatalogItem[];
  thisWeek: CatalogItem[];
  earlier: CatalogItem[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const result = {
    today: [] as CatalogItem[],
    yesterday: [] as CatalogItem[],
    thisWeek: [] as CatalogItem[],
    earlier: [] as CatalogItem[],
  };

  const getTimestamp = (item: CatalogItem) => {
    const p = item as any;
    return new Date(p.accessedAt || p.lastOpenedAt || p.updatedAt || p.createdAt || 0).getTime();
  };

  const sorted = [...items].sort((a, b) => getTimestamp(b) - getTimestamp(a));

  for (const item of sorted) {
    const time = getTimestamp(item);
    if (time >= todayStart) {
      result.today.push(item);
    } else if (time >= yesterdayStart) {
      result.yesterday.push(item);
    } else if (time >= weekStart) {
      result.thisWeek.push(item);
    } else {
      result.earlier.push(item);
    }
  }

  return result;
}

/**
 * Formats a timestamp into a human-friendly relative reading label.
 */
export function formatSessionDate(dateString?: string | null): string {
  if (!dateString) return 'Not opened yet';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Backwards-compatible Function Aliases ─────────────────────────────────────
export const getCollectionWithDescendantIds = getDescendantIds;
export const calculateduplicateItemIds = getDuplicateIds;
export const calculateDuplicateItemIds = getDuplicateIds;
export const calculateDuplicatePaperIds = getDuplicateIds;
export const filterAndSortLibraryitems = sortFilterItems;
export const filterAndSortLibraryItems = sortFilterItems;
export const filterAndSortLibraryPapers = sortFilterItems;
export const filterTrashitems = filterTrash;
export const filterTrashItems = filterTrash;
export const filterTrashPapers = filterTrash;
export const isUnfiledPaper = isUnfiled;
export const filterUnfileditems = filterUnfiled;
export const filterUnfiledItems = filterUnfiled;
export const filterUnfiledPapers = filterUnfiled;
export const groupRecentlyReadByTime = groupByTime;
export const formatReadingSession = formatSessionDate;
