import type { CatalogItem, DuplicateCluster } from '../types/library.types';
import { cleanDoi } from './library.util';

export type { DuplicateCluster };

/**
 * Groups duplicate items into clusters by matching DOI or normalized title.
 */
export function findDuplicateClusters(items: CatalogItem[]): DuplicateCluster[] {
  const clusters: DuplicateCluster[] = [];
  const visited = new Set<string>();

  // 1. Group by DOI
  const doiMap = new Map<string, CatalogItem[]>();
  for (const item of items) {
    if (item.doi && cleanDoi(item.doi)) {
      const doi = cleanDoi(item.doi).toLowerCase();
      const group = doiMap.get(doi) || [];
      doiMap.set(doi, [...group, item]);
    }
  }

  doiMap.forEach((group, doi) => {
    if (group.length > 1) {
      group.forEach((p) => visited.add(p.id));
      clusters.push({
        id: `doi-${doi}`,
        reason: 'doi',
        items: group,
      });
    }
  });

  // 2. Group unclustered items by normalized title
  const remaining = items.filter((p) => !visited.has(p.id));
  const titleMap = new Map<string, CatalogItem[]>();

  for (const item of remaining) {
    if (item.title && item.title.trim().length > 15) {
      const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const group = titleMap.get(norm) || [];
      titleMap.set(norm, [...group, item]);
    }
  }

  titleMap.forEach((group, norm) => {
    if (group.length > 1) {
      group.forEach((p) => visited.add(p.id));
      clusters.push({
        id: `title-${norm.slice(0, 16)}`,
        reason: 'title',
        items: group,
      });
    }
  });

  return clusters;
}

/**
 * Computes a metadata completeness score for an item (0 to 100).
 */
export function getCompletenessScore(item: CatalogItem): number {
  let score = 0;
  if (item.title) score += 20;
  if (item.authors && item.authors.length > 0) score += 20;
  if (item.year) score += 15;
  if (item.doi) score += 15;
  if (item.abstract) score += 10;
  if (item.journal || item.publisher) score += 10;
  if (item.fileUrl || item.primaryFile?.url) score += 10;
  return score;
}

export const calculateMergeCompleteness = getCompletenessScore;
export const findDuplicates = findDuplicateClusters;
