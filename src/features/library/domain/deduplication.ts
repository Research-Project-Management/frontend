/**
 * Pure Domain Model: Deduplication & Duplicate Matching Engine
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

import type { Item, DuplicateGroup } from '../types/library.types';
import { cleanDoi } from './identifiers';
import { normalizeAuthors } from './creators';

export type DuplicateMatchCriteria = 'EXACT_DOI' | 'TITLE_AUTHOR_YEAR' | 'EXACT_ARXIV';

export interface DuplicateCandidatePair {
  original: Item;
  duplicates: Item[];
  items: Item[];
  criteria: DuplicateMatchCriteria;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Normalizes title for fuzzy duplicate comparison: strips punctuation, spaces, accents.
 */
export function normalizeTitleForDeduplication(title?: string | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if two items are duplicates based on DOI or normalized Title + Year + Author.
 */
export function isDuplicatePair(paperA: Partial<Item>, paperB: Partial<Item>): { isMatch: boolean; isDuplicate: boolean; criteria?: DuplicateMatchCriteria; confidence?: 'high' | 'medium' | 'low' } {
  if (paperA.id && paperB.id && paperA.id === paperB.id) {
    return { isMatch: false, isDuplicate: false };
  }

  // 1. Exact DOI match
  if (paperA.doi && paperB.doi) {
    const cleanA = cleanDoi(paperA.doi)?.toLowerCase();
    const cleanB = cleanDoi(paperB.doi)?.toLowerCase();
    if (cleanA && cleanA === cleanB) {
      return { isMatch: true, isDuplicate: true, criteria: 'EXACT_DOI', confidence: 'high' };
    }
  }

  // 2. Exact arXiv ID match
  if (paperA.arxivId && paperB.arxivId) {
    const a = paperA.arxivId.trim().toLowerCase().replace(/v\d+$/, '');
    const b = paperB.arxivId.trim().toLowerCase().replace(/v\d+$/, '');
    if (a && a === b) {
      return { isMatch: true, isDuplicate: true, criteria: 'EXACT_ARXIV', confidence: 'high' };
    }
  }

  // 3. Fuzzy Title + Author / Year match
  if (paperA.title && paperB.title) {
    const normA = normalizeTitleForDeduplication(paperA.title);
    const normB = normalizeTitleForDeduplication(paperB.title);

    if (normA.length >= 15 && normA === normB) {
      const yearA = paperA.year ? String(paperA.year) : null;
      const yearB = paperB.year ? String(paperB.year) : null;
      const sameYear = !yearA || !yearB || yearA === yearB;

      const authA = normalizeAuthors(paperA.authors)[0]?.toLowerCase();
      const authB = normalizeAuthors(paperB.authors)[0]?.toLowerCase();
      const sameFirstAuthor = !authA || !authB || authA === authB;

      if (sameYear && sameFirstAuthor) {
        return {
          isMatch: true,
          isDuplicate: true,
          criteria: 'TITLE_AUTHOR_YEAR',
          confidence: sameYear && sameFirstAuthor ? 'high' : 'medium',
        };
      }
    }
  }

  return { isMatch: false, isDuplicate: false };
}

/**
 * Client-side fallback clusterer to detect duplicate groups across a list of items.
 */
export function clusterDuplicateItems(items: Item[]): DuplicateCandidatePair[] {
  const results: DuplicateCandidatePair[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const currentId = current.id;
    if (visited.has(currentId)) continue;

    const dupes: Item[] = [];
    let detectedCriteria: DuplicateMatchCriteria = 'TITLE_AUTHOR_YEAR';
    let detectedConfidence: 'high' | 'medium' | 'low' = 'medium';

    for (let j = i + 1; j < items.length; j++) {
      const other = items[j];
      const otherId = other.id;
      if (visited.has(otherId)) continue;

      const check = isDuplicatePair(current, other);
      if (check.isMatch) {
        dupes.push(other);
        visited.add(otherId);
        if (check.criteria) detectedCriteria = check.criteria;
        if (check.confidence === 'high') detectedConfidence = 'high';
      }
    }

    if (dupes.length > 0) {
      visited.add(currentId);
      results.push({
        original: current,
        duplicates: dupes,
        items: [current, ...dupes],
        criteria: detectedCriteria,
        confidence: detectedConfidence,
      });
    }
  }

  return results;
}
