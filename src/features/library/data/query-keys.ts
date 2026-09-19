/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation.
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

  // Collections (Folder Tree)
  collections: (scopeId?: string) =>
    [...libraryKeys.all, 'collections', scopeId || 'user'] as const,
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

  // Saved Searches
  savedSearches: (scopeId?: string) =>
    [...libraryKeys.all, 'saved-searches', scopeId || 'user'] as const,

  // Duplicates
  duplicates: (scopeId?: string) =>
    [...libraryKeys.all, 'duplicates', scopeId || 'user'] as const,

  // Citations
  citation: (scopeId?: string, itemId?: string, style?: string, index?: number) =>
    [...libraryKeys.all, 'citation', scopeId || 'user', itemId || 'none', style || 'apa', index || 1] as const,
};
