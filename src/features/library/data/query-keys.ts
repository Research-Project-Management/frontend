import type { QueryClient } from '@tanstack/react-query';
import type { CslStyle } from '@/features/library/types/library.types';

/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation and single source of truth.
 */
export const DEFAULT_SCOPE = 'user';

export const libraryKeys = {
  all: ['library'] as const,

  // Items
  items: (scopeId?: string, params?: unknown) =>
    [...libraryKeys.all, 'items', scopeId || DEFAULT_SCOPE, (params ?? {}) as Record<string, unknown>] as const,
  counts: (scopeId?: string) =>
    [...libraryKeys.all, 'counts', scopeId || DEFAULT_SCOPE] as const,
  item: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  fulltext: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'fulltext', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  itemState: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item-state', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  itemTypes: (scopeId?: string) =>
    [...libraryKeys.all, 'item-types', scopeId || DEFAULT_SCOPE] as const,

  // Collections (Folder Tree & Flat List)
  collections: (scopeId?: string) =>
    [...libraryKeys.all, 'collections', scopeId || DEFAULT_SCOPE] as const,
  collectionsList: (scopeId?: string) =>
    [...libraryKeys.all, 'collections-list', scopeId || DEFAULT_SCOPE] as const,
  collection: (scopeId?: string, collectionId?: string) =>
    [...libraryKeys.all, 'collection', scopeId || DEFAULT_SCOPE, collectionId || 'none'] as const,

  // Tags
  tags: (scopeId?: string) =>
    [...libraryKeys.all, 'tags', scopeId || DEFAULT_SCOPE] as const,

  // Attachments & Annotations
  attachments: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'attachments', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  annotations: (scopeId?: string, attachmentId?: string) =>
    [...libraryKeys.all, 'annotations', scopeId || DEFAULT_SCOPE, attachmentId || 'none'] as const,

  // Notes
  notes: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'notes', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,

  // Relations
  relations: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'relations', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,

  // Saved Searches
  savedSearches: (scopeId?: string) =>
    [...libraryKeys.all, 'saved-searches', scopeId || DEFAULT_SCOPE] as const,

  // Curation: Duplicates, Integrity & Retractions
  duplicates: (scopeId?: string) =>
    [...libraryKeys.all, 'duplicates', scopeId || DEFAULT_SCOPE] as const,
  integrity: (scopeId?: string) =>
    [...libraryKeys.all, 'curation', scopeId || DEFAULT_SCOPE, 'integrity'] as const,
  retractions: (scopeId?: string) =>
    [...libraryKeys.all, 'retractions', scopeId || DEFAULT_SCOPE] as const,

  // Citations & Exports
  citation: (scopeId?: string, itemId?: string, style?: string, index?: number) =>
    [...libraryKeys.all, 'citation', scopeId || DEFAULT_SCOPE, itemId || 'none', style || 'apa', index || 1] as const,
  exports: () => [...libraryKeys.all, 'exports'] as const,

  // Search
  search: () => [...libraryKeys.all, 'search'] as const,

  // Sync (Distributed Replication CDC)
  syncVersion: (scopeId?: string) =>
    [...libraryKeys.all, 'sync-version', scopeId || DEFAULT_SCOPE] as const,
  syncChanges: (scopeId?: string, params?: unknown) =>
    [...libraryKeys.all, 'sync-changes', scopeId || DEFAULT_SCOPE, typeof params === 'string' ? { since: params } : ((params ?? {}) as Record<string, unknown>)] as const,
  syncTombstones: (scopeId?: string, params?: unknown) =>
    [...libraryKeys.all, 'sync-tombstones', scopeId || DEFAULT_SCOPE, typeof params === 'string' ? { since: params } : ((params ?? {}) as Record<string, unknown>)] as const,

  // Metadata Sources (Provenance)
  itemMetadataSources: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'metadata-sources', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,

  // Ingestion
  ingestion: (scopeId?: string) =>
    [...libraryKeys.all, 'ingest', scopeId || DEFAULT_SCOPE] as const,
  ingestionRun: (scopeId?: string, runId?: string) =>
    [...libraryKeys.all, 'ingest', scopeId || DEFAULT_SCOPE, runId || 'none'] as const,
};

/**
 * Domain-specific key factories mapped directly to canonical libraryKeys
 */
export const itemKeys = {
  all: (scopeId?: string) => [...libraryKeys.all, 'items', scopeId || DEFAULT_SCOPE] as const,
  byId: (scopeId?: string, itemId?: string) => libraryKeys.item(scopeId, itemId),
  byCollection: (scopeId?: string, collectionId?: string) =>
    libraryKeys.items(scopeId, { collectionId }),
  byView: (scopeId?: string, view?: string, search?: string) =>
    libraryKeys.items(scopeId, { view: view || 'all', search: search || '' }),
  trash: (scopeId?: string) => libraryKeys.items(scopeId, { view: 'trash' }),
  state: (scopeId?: string, itemId?: string) => libraryKeys.itemState(scopeId, itemId),
  types: (scopeId?: string) => libraryKeys.itemTypes(scopeId),
  counts: (scopeId?: string) => libraryKeys.counts(scopeId),
};

export const collectionKeys = {
  all: (scopeId?: string) => libraryKeys.collections(scopeId),
  byId: (scopeId?: string, collectionId?: string) => libraryKeys.collection(scopeId, collectionId),
};

export const tagKeys = {
  all: [...libraryKeys.all, 'tags'] as const,
  list: (scopeId?: string) => libraryKeys.tags(scopeId),
};

export const noteKeys = {
  all: (scopeId?: string) => [...libraryKeys.all, 'notes', scopeId || DEFAULT_SCOPE] as const,
  lists: () => [...libraryKeys.all, 'notes'] as const,
  list: (scopeId?: string, itemId?: string) => libraryKeys.notes(scopeId, itemId),
  detail: (scopeId?: string, id?: string) =>
    [...libraryKeys.all, 'notes', scopeId || DEFAULT_SCOPE, 'detail', id || 'none'] as const,
};

export const savedSearchKeys = {
  all: (scopeId?: string) => libraryKeys.savedSearches(scopeId),
  byId: (scopeId: string | undefined, id: string) =>
    [...libraryKeys.savedSearches(scopeId), id] as const,
  results: (scopeId: string | undefined, id: string, params?: Record<string, unknown>) =>
    [...libraryKeys.savedSearches(scopeId), id, 'results', params] as const,
};

export const relationKeys = {
  all: (scopeId?: string, itemId?: string) => libraryKeys.relations(scopeId, itemId),
};

export const attachmentKeys = {
  byItem: (scopeId?: string, itemId?: string) => libraryKeys.attachments(scopeId, itemId),
};

export const annotationKeys = {
  all: (scopeId?: string) => [...libraryKeys.all, 'annotations', scopeId || DEFAULT_SCOPE] as const,
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
};

export const ingestKeys = {
  all: (scopeId?: string) => libraryKeys.ingestion(scopeId),
  status: (scopeId?: string, runId?: string) => libraryKeys.ingestionRun(scopeId, runId),
};

export const curationKeys = {
  duplicates: (scopeId?: string) => libraryKeys.duplicates(scopeId),
  integrity: (scopeId?: string) => libraryKeys.integrity(scopeId),
};

export const retractionKeys = {
  all: (scopeId?: string) => libraryKeys.retractions(scopeId),
  stats: (scopeId?: string) => [...libraryKeys.retractions(scopeId), 'stats'] as const,
  items: (scopeId?: string) => [...libraryKeys.retractions(scopeId), 'items'] as const,
};

export const citationKeys = {
  all: [...libraryKeys.all, 'citation'] as const,
  styles: (scopeId?: string) => [...libraryKeys.all, 'citation', 'styles', scopeId || DEFAULT_SCOPE] as const,
  item: (scopeId?: string, itemId?: string, style: CslStyle = 'apa', index: number = 1) =>
    [...libraryKeys.all, 'citation', 'item', scopeId || DEFAULT_SCOPE, itemId || 'none', style, index] as const,
  batch: (scopeId?: string, itemIds: string[] = [], style: CslStyle = 'apa') =>
    [...libraryKeys.all, 'citation', 'batch', scopeId || DEFAULT_SCOPE, itemIds.join(','), style] as const,
};

export const exportKeys = {
  all: libraryKeys.exports(),
  collectionBundle: (scopeId?: string, collectionId?: string) =>
    [...libraryKeys.exports(), 'bundle', scopeId || DEFAULT_SCOPE, collectionId || 'none'] as const,
  collectionBibtex: (scopeId?: string, collectionId?: string) =>
    [...libraryKeys.exports(), 'bibtex', scopeId || DEFAULT_SCOPE, collectionId || 'none'] as const,
};

export const searchKeys = {
  all: libraryKeys.search(),
  items: (scopeId?: string, params?: unknown) =>
    [...libraryKeys.search(), 'items', scopeId || DEFAULT_SCOPE, params] as const,
  anchors: (scopeId?: string, attachmentId?: string, term?: string, pageIndex?: number) =>
    [...libraryKeys.search(), 'anchors', scopeId || DEFAULT_SCOPE, attachmentId || 'none', term || '', pageIndex ?? 'all'] as const,
};

export function invalidateCollections(qc: QueryClient, scopeId?: string): void {
  qc.invalidateQueries({ queryKey: libraryKeys.collections(scopeId) });
  qc.invalidateQueries({ queryKey: libraryKeys.collectionsList(scopeId) });
  qc.invalidateQueries({ queryKey: itemKeys.counts(scopeId) });
}

/**
 * Unified Reader Query Keys mapped directly to libraryKeys
 */
export const readerQueryKeys = {
  all: libraryKeys.all,
  item: (scopeId?: string, itemId?: string) => libraryKeys.item(scopeId, itemId),
  fulltext: (scopeId?: string, itemId?: string) => libraryKeys.fulltext(scopeId, itemId),
  metadataSources: (scopeId?: string, itemId?: string) =>
    libraryKeys.itemMetadataSources(scopeId, itemId),
  annotations: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
  notes: (scopeId?: string, itemId?: string) => libraryKeys.notes(scopeId, itemId),
  state: (scopeId?: string, itemId?: string) => libraryKeys.itemState(scopeId, itemId),
  attachments: (scopeId?: string, itemId?: string) => libraryKeys.attachments(scopeId, itemId),
  collections: (scopeId?: string) => libraryKeys.collections(scopeId),
  itemCollections: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item-collections', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  tags: (scopeId?: string) => libraryKeys.tags(scopeId),
  itemTags: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item-tags', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  relations: (scopeId?: string, itemId?: string) => libraryKeys.relations(scopeId, itemId),
  citation: (scopeId?: string, itemId?: string, style?: string) =>
    libraryKeys.citation(scopeId, itemId, style),
  bibtex: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'bibtex', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
  styles: (query?: string) =>
    [...libraryKeys.all, 'csl-styles', query || 'all'] as const,
  itemTypes: () => libraryKeys.itemTypes(),
};

export const readerAnnotationKeys = {
  all: [...libraryKeys.all, 'annotations'] as const,
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    readerQueryKeys.annotations(scopeId, attachmentId),
};

export const readerNoteKeys = {
  all: [...libraryKeys.all, 'notes'] as const,
  list: (scopeId?: string, itemId?: string) =>
    readerQueryKeys.notes(scopeId, itemId),
  detail: (scopeId?: string, id?: string) =>
    noteKeys.detail(scopeId, id),
};

export const readerStateKeys = {
  all: [...libraryKeys.all, 'item-state'] as const,
  item: (scopeId?: string, itemId?: string) =>
    readerQueryKeys.state(scopeId, itemId),
};

