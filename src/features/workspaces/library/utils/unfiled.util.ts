import type { Paper } from '../types/library.types';

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
