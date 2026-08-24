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
  if (activeFilter === 'starred') {
    filteredPapers = filteredPapers.filter(
      (paper) =>
        Boolean(paper.isFavorite) ||
        paper.labels?.includes('starred') ||
        paper.labels?.includes('favorite') ||
        Boolean((paper as any).isStarred),
    );
  } else if (activeFilter === 'recent-read') {
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
