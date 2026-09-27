/**
 * Pure Domain Model: Search & Filtering Engine
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

import type { Item } from '../types/library.types';
import { normalizeAuthors } from './creators';

export interface LibraryFilterOptions {
  searchQuery?: string;
  collectionId?: string | null;
  selectedTags?: string[];
  fromYear?: number;
  toYear?: number;
  itemType?: string;
  hasAttachment?: boolean;
}

export interface SortOptions {
  field: 'title' | 'year' | 'authors' | 'journal' | 'createdAt' | string;
  direction: 'asc' | 'desc';
}

export function isPaperInCollection(paper: Item, collectionId: string): boolean {
  if (!collectionId) return true;
  if (paper.collectionId === collectionId) return true;

  const p = paper as { collections?: Array<string | { id?: string }>; collectionIds?: string[] };
  if (Array.isArray(p.collections)) {
    return p.collections.some((c) => (typeof c === 'string' ? c === collectionId : c?.id === collectionId));
  }
  if (Array.isArray(p.collectionIds)) {
    return p.collectionIds.includes(collectionId);
  }
  return false;
}

export function normalizeSearchText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface NormalizedItemSearchFields {
  authors: string[];
  title: string;
  abstract: string;
  journal: string;
  doi: string;
  yearStr: string;
  tags: string[];
}

const itemSearchIndexCache = new WeakMap<object, NormalizedItemSearchFields>();

function getOrComputeSearchFields(paper: Item): NormalizedItemSearchFields {
  let cached = itemSearchIndexCache.get(paper);
  if (!cached) {
    const p = paper as {
      creators?: Array<{ name?: string }>;
      tags?: unknown[];
      labels?: unknown[];
      keywords?: unknown[];
    };
    const rawTags = p.tags || p.labels || p.keywords || [];
    cached = {
      authors: normalizeAuthors(paper.authors, p.creators).map(normalizeSearchText),
      title: normalizeSearchText(paper.title || ''),
      abstract: normalizeSearchText(paper.abstract || ''),
      journal: normalizeSearchText(paper.journal || paper.publicationTitle || paper.publisher || ''),
      doi: normalizeSearchText(paper.doi || ''),
      yearStr: String(paper.year || ''),
      tags: rawTags.map((t) =>
        normalizeSearchText(typeof t === 'string' ? t : (t as { name?: string })?.name || '')
      ),
    };
    itemSearchIndexCache.set(paper, cached);
  }
  return cached;
}

export class LibraryFilterEngine {
  static filterBySearch(items: Item[], query: string): Item[] {
    if (!query || !query.trim()) return items;
    const normQuery = normalizeSearchText(query);
    const tokens = normQuery.split(' ').filter(Boolean);
    if (tokens.length === 0) return items;

    const scoredItems: Array<{ paper: Item; score: number }> = [];

    for (const paper of items) {
      const { authors, title, abstract: abs, journal, doi, yearStr, tags } = getOrComputeSearchFields(paper);

      let totalScore = 0;
      let allTokensMatch = true;

      for (const token of tokens) {
        let tokenScore = 0;

        if (title.includes(token)) {
          tokenScore = Math.max(tokenScore, title.startsWith(token) ? 100 : 80);
        }
        if (authors.some((a) => a.includes(token))) {
          tokenScore = Math.max(tokenScore, 70);
        }
        if (tags.some((t) => t.includes(token))) {
          tokenScore = Math.max(tokenScore, 70);
        }
        if (yearStr === token) {
          tokenScore = Math.max(tokenScore, 65);
        }
        if (journal.includes(token)) {
          tokenScore = Math.max(tokenScore, 50);
        }
        if (doi.includes(token)) {
          tokenScore = Math.max(tokenScore, 50);
        }
        if (abs.includes(token)) {
          tokenScore = Math.max(tokenScore, 30);
        }

        if (tokenScore === 0) {
          allTokensMatch = false;
          break;
        }

        totalScore += tokenScore;
      }

      if (allTokensMatch) {
        scoredItems.push({ paper, score: totalScore });
      }
    }

    return scoredItems.sort((a, b) => b.score - a.score).map((s) => s.paper);
  }

  static filter(items: Item[], options: LibraryFilterOptions): Item[] {
    const { searchQuery, collectionId, selectedTags, fromYear, toYear, itemType, hasAttachment } = options;

    let result = items;
    if (searchQuery) {
      result = this.filterBySearch(result, searchQuery);
    }

    return result.filter((paper) => {
      const p = paper as { creators?: unknown[]; tags?: unknown[]; labels?: unknown[]; keywords?: unknown[]; type?: string; hasPdf?: boolean; attachments?: unknown[] };

      if (collectionId !== undefined && collectionId !== null) {
        if (!isPaperInCollection(paper, collectionId)) {
          return false;
        }
      }

      if (selectedTags && selectedTags.length > 0) {
        const rawTags = p.tags || p.labels || p.keywords || [];
        const paperTags = rawTags.map((t) =>
          (typeof t === 'string' ? t.toLowerCase() : (t as { name?: string })?.name?.toLowerCase() || '')
        );
        const hasAllTags = selectedTags.every((t) => paperTags.includes(t.toLowerCase()));
        if (!hasAllTags) return false;
      }

      if (fromYear !== undefined && fromYear !== null) {
        const pYear = typeof paper.year === 'number' ? paper.year : parseInt(String(paper.year || 0), 10);
        if (pYear && pYear < fromYear) return false;
      }
      if (toYear !== undefined && toYear !== null) {
        const pYear = typeof paper.year === 'number' ? paper.year : parseInt(String(paper.year || 0), 10);
        if (pYear && pYear > toYear) return false;
      }

      if (itemType && itemType !== 'all') {
        const pType = (paper.itemType || p.type || '').toLowerCase();
        if (pType !== itemType.toLowerCase()) return false;
      }

      if (hasAttachment !== undefined) {
        const hasFile = Boolean(paper.fileUrl || paper.primaryFile?.url || p.hasPdf || (p.attachments && p.attachments.length > 0));
        if (hasAttachment && !hasFile) return false;
        if (!hasAttachment && hasFile) return false;
      }

      return true;
    });
  }

  static sort(items: Item[], options: SortOptions): Item[] {
    const { field, direction } = options;
    const modifier = direction === 'desc' ? -1 : 1;

    if (!items || items.length <= 1) return items;

    if (field === 'year') {
      return [...items].sort((a, b) => {
        const yA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || 0), 10);
        const yB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || 0), 10);
        return (yA - yB) * modifier;
      });
    }

    if (field === 'title') {
      const projected = items.map((item, idx) => ({
        item,
        key: (item.title || '').toLowerCase(),
        idx,
      }));
      projected.sort((a, b) => {
        const cmp = a.key.localeCompare(b.key);
        return (cmp !== 0 ? cmp : a.idx - b.idx) * modifier;
      });
      return projected.map((p) => p.item);
    }

    if (field === 'authors') {
      // Schwartzian Transform: O(N) pre-projection instead of O(N log N) normalizeAuthors in comparator
      const projected = items.map((item, idx) => {
        const aCreators = (item as { creators?: Array<{ name?: string }> }).creators;
        const a1 = (normalizeAuthors(item.authors, aCreators)[0] || '').toLowerCase();
        return { item, a1, idx };
      });
      projected.sort((a, b) => {
        const cmp = a.a1.localeCompare(b.a1);
        return (cmp !== 0 ? cmp : a.idx - b.idx) * modifier;
      });
      return projected.map((p) => p.item);
    }

    return [...items].sort((a, b) => {
      const recA = a as unknown as Record<string, unknown>;
      const recB = b as unknown as Record<string, unknown>;
      const valA = String(recA[field] ?? '');
      const valB = String(recB[field] ?? '');
      return valA.localeCompare(valB) * modifier;
    });
  }
}

export function filterItems(
  items: Item[],
  query: string = '',
  collectionId: string | null = null,
  activeTag: string | null = null
): Item[] {
  return LibraryFilterEngine.filter(items, {
    searchQuery: query,
    collectionId,
    selectedTags: activeTag ? [activeTag] : undefined,
  });
}

export const filterPapers = filterItems;

export type LibraryFileFilter = 'all' | 'has-pdf' | 'missing-pdf' | 'has-notes';
export type LibraryReadStatusFilter = 'all' | 'unread' | 'reading' | 'completed';

export interface FilterItemsOptions {
  items: Item[];
  searchQuery?: string;
  activeFilter?: string | null;
  activeTag?: string | null;
  activeTags?: string[];
  activeCollectionId?: string | null;
  collectionIds?: Set<string>;
  duplicateItemIds?: Set<string>;
  fileStatus?: LibraryFileFilter | null;
  readStatus?: LibraryReadStatusFilter | string | null;
  itemTypes?: string[];
  fromYear?: number | null;
  toYear?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isRetractedOnly?: boolean | null;
  isMyPublicationOnly?: boolean | null;
}

export function sortFilterItems({
  items,
  searchQuery = '',
  activeFilter = null,
  activeTag = null,
  activeTags = [],
  activeCollectionId = null,
  collectionIds,
  duplicateItemIds = new Set<string>(),
  fileStatus = null,
  readStatus = null,
  itemTypes = [],
  fromYear = null,
  toYear = null,
  startDate = null,
  endDate = null,
  isRetractedOnly = null,
  isMyPublicationOnly = null,
}: FilterItemsOptions): Item[] {
  const effectiveTags =
    activeTags && activeTags.length > 0
      ? activeTags.map((t) => t.toLowerCase())
      : activeTag
      ? activeTag.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

  const lowerTypes = (itemTypes || []).map((t) => t.toLowerCase());
  const targetReadStatuses =
    readStatus && readStatus !== 'all'
      ? readStatus.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const effectiveFromYear =
    fromYear ?? (startDate ? parseInt(startDate.split('-')[0], 10) : null);
  const effectiveToYear =
    toYear ?? (endDate ? parseInt(endDate.split('-')[0], 10) : null);

  // Single-pass O(N) predicate evaluation: avoids 9 intermediate array allocations
  const filtered = items.filter((item) => {
    // 1. Trash status
    if (activeFilter === 'trash') {
      if (!item.deletedAt) return false;
    } else {
      if (item.deletedAt) return false;
    }

    // 2. Collection membership
    if (activeCollectionId) {
      if (collectionIds && collectionIds.size > 0) {
        if (!item.collectionId || !collectionIds.has(item.collectionId)) return false;
      } else {
        if (item.collectionId !== activeCollectionId) return false;
      }
    }

    // 3. System View Filter
    if (activeFilter === 'unfiled') {
      if (item.collectionId) return false;
    } else if (activeFilter === 'starred' || activeFilter === 'favorites') {
      const p = item as {
        rating?: number;
        isStarred?: boolean;
        states?: Array<{ rating?: number }>;
      };
      const isStarred =
        (typeof p.rating === 'number' && p.rating > 0) ||
        Boolean(p.isStarred) ||
        Boolean(p.states?.[0]?.rating && p.states[0].rating > 0);
      if (!isStarred) return false;
    } else if (activeFilter === 'duplicates') {
      if (!duplicateItemIds.has(item.id)) return false;
    } else if (activeFilter === 'retracted' || isRetractedOnly) {
      if (!item.isRetracted) return false;
    } else if (
      activeFilter === 'my-publications' ||
      activeFilter === 'publications' ||
      isMyPublicationOnly
    ) {
      if (!item.isMyPublication) return false;
    }

    // 4. Tags matching
    if (effectiveTags.length > 0) {
      const p = item as {
        tags?: unknown[];
        labels?: unknown[];
        keywords?: unknown[];
      };
      const rawTags = (item.labels ||
        p.tags ||
        p.keywords ||
        []) as Array<string | { name?: string }>;
      const itemTags = rawTags.map((t) =>
        typeof t === 'string' ? t.toLowerCase() : t?.name?.toLowerCase() || '',
      );
      if (!effectiveTags.every((t) => itemTags.includes(t))) return false;
    }

    // 5. File Status
    if (fileStatus && fileStatus !== 'all') {
      const p = item as {
        fileUrl?: string;
        primaryFile?: { url?: string };
        hasPdf?: boolean;
        attachments?: unknown[];
        notesList?: unknown[];
        notes?: unknown;
      };
      const hasFile = Boolean(
        p.fileUrl ||
          p.primaryFile?.url ||
          p.hasPdf ||
          (Array.isArray(p.attachments) && p.attachments.length > 0),
      );
      const hasNotes = Boolean(
        (Array.isArray(p.notesList) && p.notesList.length > 0) || p.notes,
      );
      if (fileStatus === 'has-pdf' && !hasFile) return false;
      if (fileStatus === 'missing-pdf' && hasFile) return false;
      if (fileStatus === 'has-notes' && !hasNotes) return false;
    }

    // 6. Read Status
    if (targetReadStatuses.length > 0) {
      const p = item as {
        readStatus?: string;
        states?: Array<{ readStatus?: string }>;
      };
      const currentReadStatus = (
        p.readStatus ||
        p.states?.[0]?.readStatus ||
        'unread'
      ).toLowerCase();
      if (!targetReadStatuses.includes(currentReadStatus)) return false;
    }

    // 7. Item Types
    if (lowerTypes.length > 0) {
      const p = item as { type?: string; itemType?: string };
      const it = (item.itemType || p.type || '').toLowerCase();
      if (!lowerTypes.includes(it)) return false;
    }

    // 8. Date / Year Range
    const y =
      typeof item.year === 'number'
        ? item.year
        : parseInt(String(item.year || 0), 10);
    if (effectiveFromYear !== null && !isNaN(effectiveFromYear) && y < effectiveFromYear) {
      return false;
    }
    if (effectiveToYear !== null && !isNaN(effectiveToYear) && y > effectiveToYear) {
      return false;
    }

    return true;
  });

  let result = filtered;

  if (activeFilter === 'recent-read') {
    result = [...result].sort((a, b) => {
      const timeA = new Date(a.accessedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.accessedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }

  // 9. Full-text / Search Query Match
  if (searchQuery && searchQuery.trim()) {
    result = LibraryFilterEngine.filterBySearch(result, searchQuery);
  }

  return result;
}
