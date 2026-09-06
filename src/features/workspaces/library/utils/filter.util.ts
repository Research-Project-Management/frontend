import type { CatalogItem } from '../types/library.types';
import { normalizeAuthors, cleanDoi } from './library.util';
import { getDuplicateIds } from './duplicates.util';

export { getDuplicateIds };

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

export function isPaperInCollection(paper: CatalogItem, collectionId: string): boolean {
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

export class LibraryFilterEngine {
  static filterBySearch(items: CatalogItem[], query: string): CatalogItem[] {
    if (!query || !query.trim()) return items;
    const q = query.toLowerCase().trim();

    return items.filter((paper) => {
      const p = paper as { creators?: Array<{ name?: string }>; tags?: unknown[]; labels?: unknown[]; keywords?: unknown[] };
      const authors = normalizeAuthors(paper.authors, p.creators);
      const inTitle = paper.title?.toLowerCase().includes(q) ?? false;
      const inAuthors = authors.some((a) => a.toLowerCase().includes(q));
      const inAbstract = paper.abstract?.toLowerCase().includes(q) ?? false;
      const inJournal = (paper.journal || paper.publicationTitle || paper.publisher)?.toLowerCase().includes(q) ?? false;
      const inDoi = paper.doi?.toLowerCase().includes(q) ?? false;
      const rawTags = p.tags || p.labels || p.keywords || [];
      const inTags = rawTags.some((t) =>
        (typeof t === 'string' ? t : (t as { name?: string })?.name || '').toLowerCase().includes(q)
      );

      return inTitle || inAuthors || inAbstract || inJournal || inDoi || inTags;
    });
  }

  static filter(items: CatalogItem[], options: LibraryFilterOptions): CatalogItem[] {
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

  static sort(items: CatalogItem[], options: SortOptions): CatalogItem[] {
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

  static isDuplicate(paperA: CatalogItem, paperB: CatalogItem): boolean {
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

  static findDuplicates(items: CatalogItem[]): Array<{ original: CatalogItem; duplicates: CatalogItem[] }> {
    const results: Array<{ original: CatalogItem; duplicates: CatalogItem[] }> = [];
    const visited = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const currentId = current.id;
      if (visited.has(currentId)) continue;

      const dupes: CatalogItem[] = [];
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
  items: CatalogItem[],
  query: string = '',
  collectionId: string | null = null,
  activeTag: string | null = null
): CatalogItem[] {
  return LibraryFilterEngine.filter(items, {
    searchQuery: query,
    collectionId,
    selectedTags: activeTag ? [activeTag] : undefined,
  });
}

export const filterPapers = filterItems;

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
  activeCollectionId = null,
  collectionIds,
  duplicateItemIds = new Set<string>(),
}: FilterItemsOptions): CatalogItem[] {
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
  } else if (activeFilter === 'duplicates') {
    result = result.filter((item) => duplicateItemIds.has(item.id));
  }

  if (activeTag) {
    result = result.filter((item) => item.labels?.includes(activeTag));
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

export function filterTrash(items: CatalogItem[]): CatalogItem[] {
  return items.filter((p) => Boolean(p.deletedAt || (p as { isTrash?: boolean }).isTrash));
}

export function isUnfiled(item: CatalogItem): boolean {
  if (item.deletedAt || (item as { isTrash?: boolean }).isTrash) return false;
  if (item.collectionId) return false;
  const p = item as { collections?: unknown[]; collectionIds?: unknown[] };
  if (Array.isArray(p.collections) && p.collections.length > 0) return false;
  if (Array.isArray(p.collectionIds) && p.collectionIds.length > 0) return false;
  return true;
}

export function filterUnfiled(items: CatalogItem[]): CatalogItem[] {
  return items.filter(isUnfiled);
}

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
