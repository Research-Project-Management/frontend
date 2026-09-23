/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation and single source of truth.
 */
export const libraryKeys = {
  all: ['library'] as const,

  // Items
  items: (scopeId?: string, params?: Record<string, any>) =>
    [...libraryKeys.all, 'items', scopeId || 'user', params ?? {}] as const,
  item: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item', scopeId || 'user', itemId || 'none'] as const,
  itemState: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'item-state', scopeId || 'user', itemId || 'none'] as const,
  itemTypes: (scopeId?: string) =>
    [...libraryKeys.all, 'item-types', scopeId || 'user'] as const,

  // Collections (Folder Tree & Flat List)
  collections: (scopeId?: string) =>
    [...libraryKeys.all, 'collections', scopeId || 'user'] as const,
  collectionsList: (scopeId?: string) =>
    [...libraryKeys.all, 'collections-list', scopeId || 'user'] as const,
  collection: (scopeId?: string, collectionId?: string) =>
    [...libraryKeys.all, 'collection', scopeId || 'user', collectionId || 'none'] as const,

  // Tags
  tags: (scopeId?: string) =>
    [...libraryKeys.all, 'tags', scopeId || 'user'] as const,

  // Attachments
  attachments: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'attachments', scopeId || 'user', itemId || 'none'] as const,

  // Notes
  notes: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'notes', scopeId || 'user', itemId || 'none'] as const,

  // Relations
  relations: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'relations', scopeId || 'user', itemId || 'none'] as const,

  // Saved Searches
  savedSearches: (scopeId?: string) =>
    [...libraryKeys.all, 'saved-searches', scopeId || 'user'] as const,

  // Curation: Duplicates & Retractions
  duplicates: (scopeId?: string) =>
    [...libraryKeys.all, 'duplicates', scopeId || 'user'] as const,
  retractions: (scopeId?: string) =>
    [...libraryKeys.all, 'retractions', scopeId || 'user'] as const,

  // Citations
  citation: (scopeId?: string, itemId?: string, style?: string, index?: number) =>
    [...libraryKeys.all, 'citation', scopeId || 'user', itemId || 'none', style || 'apa', index || 1] as const,

  // Sync (Distributed Replication CDC)
  syncVersion: (scopeId?: string) =>
    [...libraryKeys.all, 'sync-version', scopeId || 'user'] as const,
  syncChanges: (scopeId?: string, params?: Record<string, any> | string) =>
    [...libraryKeys.all, 'sync-changes', scopeId || 'user', typeof params === 'string' ? { since: params } : (params ?? {})] as const,
  syncTombstones: (scopeId?: string, params?: Record<string, any> | string) =>
    [...libraryKeys.all, 'sync-tombstones', scopeId || 'user', typeof params === 'string' ? { since: params } : (params ?? {})] as const,

  // Metadata Sources (Provenance)
  itemMetadataSources: (scopeId?: string, itemId?: string) =>
    [...libraryKeys.all, 'metadata-sources', scopeId || 'user', itemId || 'none'] as const,
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
};
