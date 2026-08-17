import type { Paper, DuplicateCluster } from '../types/library.types';
import { getLibraryEntityId, cleanDoi } from './library.util';

export type { DuplicateCluster };

/**
 * Groups duplicate papers into clusters by matching DOI or normalized title.
 */
export function findDuplicateClusters(papers: Paper[]): DuplicateCluster[] {
  const clusters: DuplicateCluster[] = [];
  const visited = new Set<string>();

  // 1. Group by DOI
  const doiMap = new Map<string, Paper[]>();
  for (const paper of papers) {
    if (paper.doi && cleanDoi(paper.doi)) {
      const doi = cleanDoi(paper.doi).toLowerCase();
      if (!doiMap.has(doi)) doiMap.set(doi, []);
      doiMap.get(doi)!.push(paper);
    }
  }

  doiMap.forEach((group, doi) => {
    if (group.length > 1) {
      const ids = group.map(getLibraryEntityId);
      ids.forEach((id) => visited.add(id));
      clusters.push({
        id: `doi-${doi}`,
        reason: 'doi',
        papers: group,
      });
    }
  });

  // 2. Group unclustered papers by normalized title
  const remainingPapers = papers.filter((p) => !visited.has(getLibraryEntityId(p)));
  const titleMap = new Map<string, Paper[]>();

  for (const paper of remainingPapers) {
    if (paper.title && paper.title.trim().length > 15) {
      const norm = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!titleMap.has(norm)) titleMap.set(norm, []);
      titleMap.get(norm)!.push(paper);
    }
  }

  titleMap.forEach((group, norm) => {
    if (group.length > 1) {
      const ids = group.map(getLibraryEntityId);
      ids.forEach((id) => visited.add(id));
      clusters.push({
        id: `title-${norm.slice(0, 16)}`,
        reason: 'title',
        papers: group,
      });
    }
  });

  return clusters;
}

/**
 * Computes a metadata completeness score for a paper (0 to 100).
 */
export function calculateMergeCompleteness(paper: Paper): number {
  let score = 0;
  if (paper.title) score += 20;
  if (paper.authors && paper.authors.length > 0) score += 20;
  if (paper.year) score += 15;
  if (paper.doi) score += 15;
  if (paper.abstract) score += 10;
  if (paper.journal || paper.publisher) score += 10;
  if (paper.fileUrl || paper.primaryFile?.url) score += 10;
  return score;
}
