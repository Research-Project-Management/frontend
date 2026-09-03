import type { CatalogItem, Paper } from '../types/library.types';
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
 * Calculates a Set of collection IDs including the target collection and all its recursive descendants
 */
export function getCollectionWithDescendantIds(
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
 * Calculates a Set of Paper IDs that are duplicate candidates based on matching DOI or normalized Title
 */
export function calculateduplicateItemIds(items: CatalogItem[]): Set<string> {
  const doiToItemIdsMap = new Map<string, string[]>();
  const titleToItemIdsMap = new Map<string, string[]>();

  for (const paper of items) {
    if (paper.deletedAt) continue;
    const itemId = paper.id;

    if (paper.doi && paper.doi.trim()) {
      const normalizedDoi = paper.doi.trim().toLowerCase();
      const existingDoiGroup = doiToItemIdsMap.get(normalizedDoi) || [];
      doiToItemIdsMap.set(normalizedDoi, [...existingDoiGroup, itemId]);
    }

    if (paper.title && paper.title.trim()) {
      const normalizedTitle = paper.title.trim().toLowerCase();
      const existingTitleGroup = titleToItemIdsMap.get(normalizedTitle) || [];
      titleToItemIdsMap.set(normalizedTitle, [...existingTitleGroup, itemId]);
    }
  }

  const duplicateItemIds = new Set<string>();

  for (const itemIds of doiToItemIdsMap.values()) {
    if (itemIds.length > 1) {
      for (const id of itemIds) {
        duplicateItemIds.add(id);
      }
    }
  }

  for (const itemIds of titleToItemIdsMap.values()) {
    if (itemIds.length > 1) {
      for (const id of itemIds) {
        duplicateItemIds.add(id);
      }
    }
  }

  return duplicateItemIds;
}

/**
 * Filters and sorts library items based on active filter, collection, tag, search query, and duplicates
 */
export function filterAndSortLibraryitems({
  items,
  searchQuery = '',
  activeFilter = null,
  activeTag = null,
  activeCollectionId = null,
  collectionIds,
  duplicateItemIds = new Set<string>(),
}: FilterItemsOptions): CatalogItem[] {
  let filtereditems = items;

  // 1. Filter out trash unless currently viewing the Trash view
  if (activeFilter === 'trash') {
    filtereditems = filtereditems.filter((paper) => Boolean(paper.deletedAt));
  } else {
    filtereditems = filtereditems.filter((paper) => !paper.deletedAt);
  }

  // 2. Filter by Collection if activeCollectionId is provided
  if (activeCollectionId) {
    if (collectionIds && collectionIds.size > 0) {
      filtereditems = filtereditems.filter(
        (paper) => paper.collectionId && collectionIds.has(paper.collectionId),
      );
    } else {
      filtereditems = filtereditems.filter(
        (paper) => paper.collectionId === activeCollectionId,
      );
    }
  }

  // 3. Apply smart view filters
  if (activeFilter === 'recent-read') {
    const accesseditems = filtereditems.filter((paper) => Boolean(paper.accessedAt));
    if (accesseditems.length > 0) {
      filtereditems = accesseditems.sort(
        (firstPaper, secondPaper) =>
          new Date(secondPaper.accessedAt || 0).getTime() -
          new Date(firstPaper.accessedAt || 0).getTime(),
      );
    } else {
      filtereditems = [...filtereditems].sort(
        (firstPaper, secondPaper) =>
          new Date(secondPaper.createdAt || 0).getTime() -
          new Date(firstPaper.createdAt || 0).getTime(),
      );
    }
  } else if (activeFilter === 'unfiled') {
    filtereditems = filtereditems.filter((paper) => !paper.collectionId);
  } else if (activeFilter === 'duplicates') {
    filtereditems = filtereditems.filter((paper) => duplicateItemIds.has(paper.id));
  }

  // 4. Apply tag filter
  if (activeTag) {
    filtereditems = filtereditems.filter((paper) => paper.labels?.includes(activeTag));
  }

  // 5. Apply search keyword query
  if (searchQuery.trim()) {
    filtereditems = filterItems(filtereditems, searchQuery);
  }

  return filtereditems;
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
 * Checks if a trashed paper has exceeded the 30-day retention window.
 */
export function isExpiredTrash(deletedAt?: string | null): boolean {
  return getDaysUntilPurge(deletedAt) === 0;
}

/**
 * Filters items marked as in trash.
 */
export function filterTrashitems(items: CatalogItem[]): CatalogItem[] {
  return items.filter((p) => Boolean(p.deletedAt || (p as any).isTrash || (p as any).isInTrash));
}

/**
 * Checks if a paper is unfiled (not assigned to any collection/folder).
 */
export function isUnfiledPaper(paper: CatalogItem): boolean {
  if (paper.deletedAt || (paper as any).isTrash || (paper as any).isInTrash) return false;
  if (paper.collectionId) return false;
  const p = paper as any;
  if (Array.isArray(p.collections) && p.collections.length > 0) return false;
  if (Array.isArray(p.collectionIds) && p.collectionIds.length > 0) return false;
  return true;
}

/**
 * Filters items that are not assigned to any collection.
 */
export function filterUnfileditems(items: CatalogItem[]): CatalogItem[] {
  return items.filter(isUnfiledPaper);
}

/**
 * Groups recently accessed items into temporal buckets (Today, Yesterday, This Week, Earlier).
 */
export function groupRecentlyReadByTime(items: CatalogItem[]): {
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
    today: [] as Paper[],
    yesterday: [] as Paper[],
    thisWeek: [] as Paper[],
    earlier: [] as Paper[],
  };

  const getTimestamp = (paper: CatalogItem) => {
    const p = paper as any;
    return new Date(p.accessedAt || p.lastOpenedAt || p.updatedAt || p.createdAt || 0).getTime();
  };

  const sorted = [...items].sort((a, b) => getTimestamp(b) - getTimestamp(a));

  for (const paper of sorted) {
    const paperTime = getTimestamp(paper);
    if (paperTime >= todayStart) {
      result.today.push(paper);
    } else if (paperTime >= yesterdayStart) {
      result.yesterday.push(paper);
    } else if (paperTime >= weekStart) {
      result.thisWeek.push(paper);
    } else {
      result.earlier.push(paper);
    }
  }

  return result;
}

/**
 * Formats a timestamp into a human-friendly relative reading label.
 */
export function formatReadingSession(dateString?: string | null): string {
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
export const calculateDuplicateItemIds = calculateduplicateItemIds;
export const calculateDuplicatePaperIds = calculateduplicateItemIds;
export const filterAndSortLibraryItems = filterAndSortLibraryitems;
export const filterAndSortLibraryPapers = filterAndSortLibraryitems;
export const filterTrashItems = filterTrashitems;
export const filterTrashPapers = filterTrashitems;
export const filterUnfiledItems = filterUnfileditems;
export const filterUnfiledPapers = filterUnfileditems;



