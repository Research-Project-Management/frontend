import type { Paper } from '../types/library.types';
import { filterPapers } from './library.util';

export interface FilterPapersOptions {
  papers: Paper[];
  searchQuery?: string;
  activeFilter?: string | null;
  activeTag?: string | null;
  activeCollectionId?: string | null;
  collectionIds?: Set<string>;
  duplicatePaperIds?: Set<string>;
}

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
export function calculateDuplicatePaperIds(papers: Paper[]): Set<string> {
  const doiToPaperIdsMap = new Map<string, string[]>();
  const titleToPaperIdsMap = new Map<string, string[]>();

  for (const paper of papers) {
    if (paper.deletedAt) continue;
    const paperId = paper.id;

    if (paper.doi && paper.doi.trim()) {
      const normalizedDoi = paper.doi.trim().toLowerCase();
      const existingDoiGroup = doiToPaperIdsMap.get(normalizedDoi) || [];
      doiToPaperIdsMap.set(normalizedDoi, [...existingDoiGroup, paperId]);
    }

    if (paper.title && paper.title.trim()) {
      const normalizedTitle = paper.title.trim().toLowerCase();
      const existingTitleGroup = titleToPaperIdsMap.get(normalizedTitle) || [];
      titleToPaperIdsMap.set(normalizedTitle, [...existingTitleGroup, paperId]);
    }
  }

  const duplicatePaperIds = new Set<string>();

  for (const paperIds of doiToPaperIdsMap.values()) {
    if (paperIds.length > 1) {
      for (const id of paperIds) {
        duplicatePaperIds.add(id);
      }
    }
  }

  for (const paperIds of titleToPaperIdsMap.values()) {
    if (paperIds.length > 1) {
      for (const id of paperIds) {
        duplicatePaperIds.add(id);
      }
    }
  }

  return duplicatePaperIds;
}

/**
 * Filters and sorts library papers based on active filter, collection, tag, search query, and duplicates
 */
export function filterAndSortLibraryPapers({
  papers,
  searchQuery = '',
  activeFilter = null,
  activeTag = null,
  activeCollectionId = null,
  collectionIds,
  duplicatePaperIds = new Set<string>(),
}: FilterPapersOptions): Paper[] {
  let filteredPapers = papers;

  // 1. Filter out trash unless currently viewing the Trash view
  if (activeFilter === 'trash') {
    filteredPapers = filteredPapers.filter((paper) => Boolean(paper.deletedAt));
  } else {
    filteredPapers = filteredPapers.filter((paper) => !paper.deletedAt);
  }

  // 2. Filter by Collection if activeCollectionId is provided
  if (activeCollectionId) {
    if (collectionIds && collectionIds.size > 0) {
      filteredPapers = filteredPapers.filter(
        (paper) => paper.collectionId && collectionIds.has(paper.collectionId),
      );
    } else {
      filteredPapers = filteredPapers.filter(
        (paper) => paper.collectionId === activeCollectionId,
      );
    }
  }

  // 3. Apply smart view filters
  if (activeFilter === 'recent-read') {
    const accessedPapers = filteredPapers.filter((paper) => Boolean(paper.accessedAt));
    if (accessedPapers.length > 0) {
      filteredPapers = accessedPapers.sort(
        (firstPaper, secondPaper) =>
          new Date(secondPaper.accessedAt || 0).getTime() -
          new Date(firstPaper.accessedAt || 0).getTime(),
      );
    } else {
      filteredPapers = [...filteredPapers].sort(
        (firstPaper, secondPaper) =>
          new Date(secondPaper.createdAt || 0).getTime() -
          new Date(firstPaper.createdAt || 0).getTime(),
      );
    }
  } else if (activeFilter === 'unfiled') {
    filteredPapers = filteredPapers.filter((paper) => !paper.collectionId);
  } else if (activeFilter === 'duplicates') {
    filteredPapers = filteredPapers.filter((paper) => duplicatePaperIds.has(paper.id));
  }

  // 4. Apply tag filter
  if (activeTag) {
    filteredPapers = filteredPapers.filter((paper) => paper.labels?.includes(activeTag));
  }

  // 5. Apply search keyword query
  if (searchQuery.trim()) {
    filteredPapers = filterPapers(filteredPapers, searchQuery);
  }

  return filteredPapers;
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
export function filterTrashPapers(papers: Paper[]): Paper[] {
  return papers.filter((p) => Boolean(p.deletedAt || (p as any).isTrash || (p as any).isInTrash));
}

/**
 * Checks if a paper is unfiled (not assigned to any collection/folder).
 */
export function isUnfiledPaper(paper: Paper): boolean {
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
export function filterUnfiledPapers(papers: Paper[]): Paper[] {
  return papers.filter(isUnfiledPaper);
}

/**
 * Groups recently accessed papers into temporal buckets (Today, Yesterday, This Week, Earlier).
 */
export function groupRecentlyReadByTime(papers: Paper[]): {
  today: Paper[];
  yesterday: Paper[];
  thisWeek: Paper[];
  earlier: Paper[];
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

  const getTimestamp = (paper: Paper) => {
    const p = paper as any;
    return new Date(p.accessedAt || p.lastOpenedAt || p.updatedAt || p.createdAt || 0).getTime();
  };

  const sorted = [...papers].sort((a, b) => getTimestamp(b) - getTimestamp(a));

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

