/**
 * Centralized Reader TanStack Query Keys
 * Completely self-contained within features/reader with no frontend library dependencies.
 */

export const readerQueryKeys = {
  all: ['reader'] as const,

  // Item / Document
  item: (scopeId?: string, itemId?: string) =>
    ['reader', 'item', scopeId || 'user', itemId || 'none'] as const,
  fulltext: (scopeId?: string, itemId?: string) =>
    ['reader', 'fulltext', scopeId || 'user', itemId || 'none'] as const,
  metadataSources: (scopeId?: string, itemId?: string) =>
    ['reader', 'metadata-sources', scopeId || 'user', itemId || 'none'] as const,

  // Annotations
  annotations: (scopeId?: string, attachmentId?: string) =>
    ['reader', 'annotations', scopeId || 'user', attachmentId || 'none'] as const,

  // Notes
  notes: (scopeId?: string, itemId?: string) =>
    ['reader', 'notes', scopeId || 'user', itemId || 'none'] as const,

  // Reading State
  state: (scopeId?: string, itemId?: string) =>
    ['reader', 'item-state', scopeId || 'user', itemId || 'none'] as const,

  // Attachments
  attachments: (scopeId?: string, itemId?: string) =>
    ['reader', 'attachments', scopeId || 'user', itemId || 'none'] as const,

  // Collections
  collections: (scopeId?: string) =>
    ['reader', 'collections', scopeId || 'user'] as const,
  itemCollections: (scopeId?: string, itemId?: string) =>
    ['reader', 'item-collections', scopeId || 'user', itemId || 'none'] as const,

  // Tags
  tags: (scopeId?: string) =>
    ['reader', 'tags', scopeId || 'user'] as const,
  itemTags: (scopeId?: string, itemId?: string) =>
    ['reader', 'item-tags', scopeId || 'user', itemId || 'none'] as const,

  // Relations
  relations: (scopeId?: string, itemId?: string) =>
    ['reader', 'relations', scopeId || 'user', itemId || 'none'] as const,

  // Citations
  citation: (scopeId?: string, itemId?: string, style?: string) =>
    ['reader', 'citation', scopeId || 'user', itemId || 'none', style || 'apa'] as const,
  bibtex: (scopeId?: string, itemId?: string) =>
    ['reader', 'bibtex', scopeId || 'user', itemId || 'none'] as const,
  styles: (query?: string) =>
    ['reader', 'csl-styles', query || 'all'] as const,

  // Schema & Types
  itemTypes: () =>
    ['reader', 'schema-item-types'] as const,
};

// ── Backward-compatible aliases ───────────────────────────────────────────────

export const readerAnnotationKeys = {
  all: ['reader', 'annotations'] as const,
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    readerQueryKeys.annotations(scopeId, attachmentId),
};

export const readerNoteKeys = {
  all: ['reader', 'notes'] as const,
  list: (scopeId?: string, itemId?: string) =>
    readerQueryKeys.notes(scopeId, itemId),
  detail: (scopeId?: string, id?: string) =>
    ['reader', 'notes', scopeId || 'user', 'detail', id || 'none'] as const,
};

export const readerStateKeys = {
  all: ['reader', 'item-state'] as const,
  item: (scopeId?: string, itemId?: string) =>
    readerQueryKeys.state(scopeId, itemId),
};
