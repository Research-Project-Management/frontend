/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation and single source of truth.
 */
export const DEFAULT_SCOPE = 'user';

export const libraryKeys = {
  all: ['library'] as const,

  // Items
  items: (scopeId?: string, params?: Record<string, any>) =>
    [...libraryKeys.all, 'items', scopeId || DEFAULT_SCOPE, params ?? {}] as const,
  counts: (scopeId?: string) =>
    [...libraryKeys.all, 'counts', scopeId || DEFAULT_SCOPE] as const,
  item: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item', scopeId || DEFAULT_SCOPE, itemId || 'none'] as const,
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

  // Curation: Duplicates & Retractions
  duplicates: (scopeId?: string) =>
    [...libraryKeys.all, 'duplicates', scopeId || DEFAULT_SCOPE] as const,
  retractions: (scopeId?: string) =>
    [...libraryKeys.all, 'retractions', scopeId || DEFAULT_SCOPE] as const,

  // Citations
  citation: (scopeId?: string, itemId?: string, style?: string, index?: number) =>
    [...libraryKeys.all, 'citation', scopeId || DEFAULT_SCOPE, itemId || 'none', style || 'apa', index || 1] as const,

  // Sync (Distributed Replication CDC)
  syncVersion: (scopeId?: string) =>
    [...libraryKeys.all, 'sync-version', scopeId || DEFAULT_SCOPE] as const,
  syncChanges: (scopeId?: string, params?: Record<string, any> | string) =>
    [...libraryKeys.all, 'sync-changes', scopeId || DEFAULT_SCOPE, typeof params === 'string' ? { since: params } : (params ?? {})] as const,
  syncTombstones: (scopeId?: string, params?: Record<string, any> | string) =>
    [...libraryKeys.all, 'sync-tombstones', scopeId || DEFAULT_SCOPE, typeof params === 'string' ? { since: params } : (params ?? {})] as const,

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
 * Backward-compatible itemKeys alias mapped directly to libraryKeys
 * Prevents cache divergence across legacy hooks and modern workspace queries.
 */
export const itemKeys = {
  all: (scopeId?: string) => ['library', 'items', scopeId || 'user'] as const,
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

export const annotationKeys = {
  all: (scopeId?: string) => ['library', 'annotations', scopeId || 'user'] as const,
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
};
