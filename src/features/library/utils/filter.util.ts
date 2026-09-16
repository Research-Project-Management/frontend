import type { Item } from '../types/library.types';
import { normalizeAuthors, cleanDoi } from './author-doi.util';
export { getDuplicateIds } from './duplicates.util';


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

function normalizeSearchText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class LibraryFilterEngine {
  static filterBySearch(items: Item[], query: string): Item[] {
    if (!query || !query.trim()) return items;
    const normQuery = normalizeSearchText(query);
    const tokens = normQuery.split(' ').filter(Boolean);
    if (tokens.length === 0) return items;

    const scoredItems: Array<{ paper: Item; score: number }> = [];

    for (const paper of items) {
      const p = paper as {
        creators?: Array<{ name?: string }>;
        tags?: unknown[];
        labels?: unknown[];
        keywords?: unknown[];
      };
      const authors = normalizeAuthors(paper.authors, p.creators).map(normalizeSearchText);
      const title = normalizeSearchText(paper.title || '');
      const abs = normalizeSearchText(paper.abstract || '');
      const journal = normalizeSearchText(paper.journal || paper.publicationTitle || paper.publisher || '');
      const doi = normalizeSearchText(paper.doi || '');
      const yearStr = String(paper.year || '');
      const rawTags = p.tags || p.labels || p.keywords || [];
      const tags = rawTags.map((t) =>
        normalizeSearchText(typeof t === 'string' ? t : (t as { name?: string })?.name || '')
      );

      let totalScore = 0;
      let allTokensMatch = true;

      for (const token of tokens) {
        let tokenScore = 0;

        // Title match (highest weight)
        if (title.includes(token)) {
          tokenScore = Math.max(tokenScore, title.startsWith(token) ? 100 : 80);
        }

        // Author match (high weight)
        if (authors.some((a) => a.includes(token))) {
          tokenScore = Math.max(tokenScore, 70);
        }

        // Tag match (high weight)
        if (tags.some((t) => t.includes(token))) {
          tokenScore = Math.max(tokenScore, 70);
        }

        // Year match
        if (yearStr === token) {
          tokenScore = Math.max(tokenScore, 65);
        }

        // Journal / Publisher match
        if (journal.includes(token)) {
          tokenScore = Math.max(tokenScore, 50);
        }

        // DOI match
        if (doi.includes(token)) {
          tokenScore = Math.max(tokenScore, 50);
        }

        // Abstract match
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

    return [...items].sort((a, b) => {
      if (field === 'year') {
        const yA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || 0), 10);
        const yB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || 0), 10);
        return (yA - yB) * modifier;
      }

      if (field === 'title') {
        return (a.title || '').localeCompare(b.title || '') * modifier;
      }

      if (field === 'authors') {
        const aCreators = (a as { creators?: Array<{ name?: string }> }).creators;
        const bCreators = (b as { creators?: Array<{ name?: string }> }).creators;
        const a1 = normalizeAuthors(a.authors, aCreators)[0] || '';
        const b1 = normalizeAuthors(b.authors, bCreators)[0] || '';
        return a1.localeCompare(b1) * modifier;
      }

      return 0;
    });
  }

  static isDuplicate(paperA: Item, paperB: Item): boolean {
    if (paperA.id && paperB.id && paperA.id === paperB.id) return false;

    if (paperA.doi && paperB.doi) {
      const cleanA = cleanDoi(paperA.doi)?.toLowerCase();
      const cleanB = cleanDoi(paperB.doi)?.toLowerCase();
      if (cleanA && cleanA === cleanB) return true;
    }

    if (paperA.title && paperB.title) {
      const normA = paperA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normB = paperB.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normA.length > 15 && normA === normB) return true;
    }

    return false;
  }

  static findDuplicates(items: Item[]): Array<{ original: Item; duplicates: Item[] }> {
    const results: Array<{ original: Item; duplicates: Item[] }> = [];
    const visited = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const currentId = current.id;
      if (visited.has(currentId)) continue;

      const dupes: Item[] = [];
      for (let j = i + 1; j < items.length; j++) {
        const other = items[j];
        const otherId = other.id;
        if (visited.has(otherId)) continue;

        if (this.isDuplicate(current, other)) {
          dupes.push(other);
          visited.add(otherId);
        }
      }

      if (dupes.length > 0) {
        visited.add(currentId);
        results.push({
          original: current,
          duplicates: dupes,
        });
      }
    }

    return results;
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

export type FilterPapersOptions = FilterItemsOptions;

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
  let result = items;

  if (activeFilter === 'trash') {
    result = result.filter((item) => Boolean(item.deletedAt));
  } else {
    result = result.filter((item) => !item.deletedAt);
  }

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
  } else if (activeFilter === 'starred' || activeFilter === 'favorites') {
    result = result.filter((item) => {
      const p = item as { rating?: number; isStarred?: boolean; states?: Array<{ rating?: number }> };
      return (typeof p.rating === 'number' && p.rating > 0) || Boolean(p.isStarred) || Boolean(p.states?.[0]?.rating && p.states[0].rating > 0);
    });
  } else if (activeFilter === 'duplicates') {
    result = result.filter((item) => duplicateItemIds.has(item.id));
  } else if (activeFilter === 'retracted') {
    result = result.filter((item) => Boolean(item.isRetracted));
  } else if (activeFilter === 'my-publications' || activeFilter === 'publications') {
    result = result.filter((item) => Boolean(item.isMyPublication));
  }

  const effectiveTags =
    activeTags && activeTags.length > 0
      ? activeTags
      : activeTag
      ? activeTag.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  if (effectiveTags.length > 0) {
    result = result.filter((item) => {
      const p = item as { tags?: unknown[]; labels?: unknown[]; keywords?: unknown[] };
      const rawTags = (item.labels || p.tags || p.keywords || []) as Array<string | { name?: string }>;
      const itemTags = rawTags.map((t) =>
        (typeof t === 'string' ? t.toLowerCase() : t?.name?.toLowerCase() || '')
      );
      return effectiveTags.every((t) => itemTags.includes(t.toLowerCase()));
    });
  }

  // 1. File Status Filter (Has PDF / Missing PDF / Has Notes)
  if (fileStatus && fileStatus !== 'all') {
    result = result.filter((item) => {
      const p = item as { fileUrl?: string; primaryFile?: { url?: string }; hasPdf?: boolean; attachments?: unknown[]; notesList?: unknown[]; notes?: unknown };
      const hasFile = Boolean(p.fileUrl || p.primaryFile?.url || p.hasPdf || (Array.isArray(p.attachments) && p.attachments.length > 0));
      const hasNotes = Boolean((Array.isArray(p.notesList) && p.notesList.length > 0) || p.notes);
      if (fileStatus === 'has-pdf') return hasFile;
      if (fileStatus === 'missing-pdf') return !hasFile;
      if (fileStatus === 'has-notes') return hasNotes;
      return true;
    });
  }

  // 2. Read Status Filter (Supports single or multi-select checkbox)
  if (readStatus && readStatus !== 'all') {
    const targetStatuses = readStatus
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (targetStatuses.length > 0) {
      result = result.filter((item) => {
        const p = item as { readStatus?: string; states?: Array<{ readStatus?: string }> };
        const currentReadStatus = (p.readStatus || p.states?.[0]?.readStatus || 'unread').toLowerCase();
        return targetStatuses.includes(currentReadStatus);
      });
    }
  }

  // 3. Item Types Filter
  if (itemTypes && itemTypes.length > 0) {
    const lowerTypes = itemTypes.map((t) => t.toLowerCase());
    result = result.filter((item) => {
      const p = item as { type?: string; itemType?: string };
      const it = (item.itemType || p.type || '').toLowerCase();
      return lowerTypes.includes(it);
    });
  }

  // 4. Date Range Filter (Year / Start Date / End Date)
  const effectiveFromYear = fromYear ?? (startDate ? parseInt(startDate.split('-')[0], 10) : null);
  const effectiveToYear = toYear ?? (endDate ? parseInt(endDate.split('-')[0], 10) : null);

  if (effectiveFromYear !== null && !isNaN(effectiveFromYear)) {
    result = result.filter((item) => {
      const y = typeof item.year === 'number' ? item.year : parseInt(String(item.year || 0), 10);
      return y >= effectiveFromYear;
    });
  }
  if (effectiveToYear !== null && !isNaN(effectiveToYear)) {
    result = result.filter((item) => {
      const y = typeof item.year === 'number' ? item.year : parseInt(String(item.year || 0), 10);
      return y <= effectiveToYear;
    });
  }

  // 5. Special Flags
  if (isRetractedOnly) {
    result = result.filter((item) => Boolean(item.isRetracted));
  }
  if (isMyPublicationOnly) {
    result = result.filter((item) => Boolean(item.isMyPublication));
  }

  if (searchQuery.trim()) {
    result = filterItems(result, searchQuery);
  }

  return result;
}

const TRASH_RETENTION_DAYS = 30;

export function getDaysUntilPurge(deletedAt?: string | null): number {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const deletedTime = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsedDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays);
}

export function isExpiredTrash(deletedAt?: string | null): boolean {
  return getDaysUntilPurge(deletedAt) === 0;
}

export function filterTrash(items: Item[]): Item[] {
  return items.filter((p) => Boolean(p.deletedAt || (p as { isTrash?: boolean }).isTrash));
}

export function isUnfiled(item: Item): boolean {
  if (item.deletedAt || (item as { isTrash?: boolean }).isTrash) return false;
  if (item.collectionId) return false;
  const p = item as { collections?: unknown[]; collectionIds?: unknown[] };
  if (Array.isArray(p.collections) && p.collections.length > 0) return false;
  if (Array.isArray(p.collectionIds) && p.collectionIds.length > 0) return false;
  return true;
}

export function filterUnfiled(items: Item[]): Item[] {
  return items.filter(isUnfiled);
}

export function groupByTime(items: Item[]): {
  today: Item[];
  yesterday: Item[];
  thisWeek: Item[];
  earlier: Item[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const result = {
    today: [] as Item[],
    yesterday: [] as Item[],
    thisWeek: [] as Item[],
    earlier: [] as Item[],
  };

  const getTimestamp = (item: Item) => {
    const p = item as { accessedAt?: string; lastOpenedAt?: string; updatedAt?: string; createdAt?: string };
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
