import type { CslStyle } from "@/features/library/domain/types/library.types";

/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation and single source of truth.
 */
export const DEFAULT_SCOPE = "user";

export function normalizeScopeId(scopeId?: string | null): string {
  return !scopeId || scopeId === "me" || scopeId === "personal" ? DEFAULT_SCOPE : scopeId;
}

export const libraryKeys = {
  all: ["library"] as const,

  // Workspace Bootstrap
  bootstrap: (scopeId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "bootstrap",
      normalizeScopeId(scopeId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,

  // Items
  items: (scopeId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeScopeId(scopeId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,
  counts: (scopeId?: string) =>
    [...libraryKeys.all, "counts", normalizeScopeId(scopeId)] as const,
  item: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeScopeId(scopeId),
      "detail",
      itemId || "none",
    ] as const,
  fulltext: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "fulltext",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,
  itemState: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "item-state",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,
  itemTypes: (scopeId?: string) =>
    [...libraryKeys.all, "item-types", normalizeScopeId(scopeId)] as const,
  typeConversionPreview: (
    scopeId?: string,
    itemId?: string,
    targetType?: string,
  ) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeScopeId(scopeId),
      "type-conversion-preview",
      itemId || "none",
      targetType || "none",
    ] as const,

  // Collections (Folder Tree & Flat List)
  collections: (scopeId?: string) =>
    [...libraryKeys.all, "collections", normalizeScopeId(scopeId)] as const,
  collection: (scopeId?: string, collectionId?: string) =>
    [
      ...libraryKeys.all,
      "collection",
      normalizeScopeId(scopeId),
      collectionId || "none",
    ] as const,

  // Tags
  tags: (scopeId?: string) =>
    [...libraryKeys.all, "tags", normalizeScopeId(scopeId)] as const,

  // Attachments & Annotations
  attachmentsAll: (scopeId?: string) =>
    [...libraryKeys.all, "attachments", normalizeScopeId(scopeId)] as const,
  attachments: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "attachments",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,
  annotationsAll: (scopeId?: string) =>
    [...libraryKeys.all, "annotations", normalizeScopeId(scopeId)] as const,
  annotations: (scopeId?: string, attachmentId?: string) =>
    [
      ...libraryKeys.all,
      "annotations",
      normalizeScopeId(scopeId),
      attachmentId || "none",
    ] as const,

  // Notes
  notes: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "notes",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,

  // Relations
  relationsAll: (scopeId?: string) =>
    [...libraryKeys.all, "relations", normalizeScopeId(scopeId)] as const,
  relations: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "relations",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,

  // Saved Searches
  savedSearches: (scopeId?: string) =>
    [...libraryKeys.all, "saved-searches", normalizeScopeId(scopeId)] as const,

  // Curation: Duplicates, Integrity & Retractions
  duplicates: (scopeId?: string) =>
    [...libraryKeys.all, "duplicates", normalizeScopeId(scopeId)] as const,
  integrity: (scopeId?: string) =>
    [
      ...libraryKeys.all,
      "curation",
      normalizeScopeId(scopeId),
      "integrity",
    ] as const,
  retractions: (scopeId?: string) =>
    [...libraryKeys.all, "retractions", normalizeScopeId(scopeId)] as const,

  // Citations & Exports
  citation: (
    scopeId?: string,
    itemId?: string,
    style?: string,
    index?: number,
  ) =>
    [
      ...libraryKeys.all,
      "citation",
      normalizeScopeId(scopeId),
      itemId || "none",
      style || "apa",
      index || 1,
    ] as const,
  exports: () => [...libraryKeys.all, "exports"] as const,

  // Search
  search: () => [...libraryKeys.all, "search"] as const,

  // Sync (Distributed Replication CDC)
  syncVersion: (scopeId?: string) =>
    [...libraryKeys.all, "sync-version", normalizeScopeId(scopeId)] as const,
  syncChanges: (scopeId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "sync-changes",
      normalizeScopeId(scopeId),
      typeof params === "string"
        ? { since: params }
        : ((params ?? {}) as Record<string, unknown>),
    ] as const,
  syncTombstones: (scopeId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "sync-tombstones",
      normalizeScopeId(scopeId),
      typeof params === "string"
        ? { since: params }
        : ((params ?? {}) as Record<string, unknown>),
    ] as const,

  // Metadata Sources (Provenance)
  itemMetadataSources: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "metadata-sources",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,

  // Ingestion
  ingestion: (scopeId?: string) =>
    [...libraryKeys.all, "ingest", normalizeScopeId(scopeId)] as const,
  ingestionRun: (scopeId?: string, runId?: string) =>
    [
      ...libraryKeys.all,
      "ingest",
      normalizeScopeId(scopeId),
      runId || "none",
    ] as const,

  // Feeds
  feeds: () => [...libraryKeys.all, "feeds"] as const,
  feedSubscriptions: () => [...libraryKeys.all, "feeds", "subscriptions"] as const,
  feedArticles: (scopeId?: string, feedUrl?: string) =>
    [
      ...libraryKeys.all,
      "feeds",
      normalizeScopeId(scopeId),
      "articles",
      feedUrl || "none",
    ] as const,
};

/**
 * Domain-specific key factories mapped directly to canonical libraryKeys
 */
export const itemKeys = {
  all: (scopeId?: string) =>
    [...libraryKeys.all, "items", normalizeScopeId(scopeId)] as const,
  byId: (scopeId?: string, itemId?: string) =>
    libraryKeys.item(scopeId, itemId),
  byCollection: (scopeId?: string, collectionId?: string) =>
    libraryKeys.items(scopeId, { collectionId }),
  byView: (scopeId?: string, view?: string, search?: string) =>
    libraryKeys.items(scopeId, { view: view || "all", search: search || "" }),
  trash: (scopeId?: string) => libraryKeys.items(scopeId, { view: "trash" }),
  state: (scopeId?: string, itemId?: string) =>
    libraryKeys.itemState(scopeId, itemId),
  types: (scopeId?: string) => libraryKeys.itemTypes(scopeId),
  typeConversionPreview: (
    scopeId?: string,
    itemId?: string,
    targetType?: string,
  ) => libraryKeys.typeConversionPreview(scopeId, itemId, targetType),
  counts: (scopeId?: string) => libraryKeys.counts(scopeId),
};

export const collectionKeys = {
  all: (scopeId?: string) => libraryKeys.collections(scopeId),
  byId: (scopeId?: string, collectionId?: string) =>
    libraryKeys.collection(scopeId, collectionId),
};

export const tagKeys = {
  all: [...libraryKeys.all, "tags"] as const,
  list: (scopeId?: string) => libraryKeys.tags(scopeId),
};

export const noteKeys = {
  all: (scopeId?: string) =>
    [...libraryKeys.all, "notes", normalizeScopeId(scopeId)] as const,
  lists: () => [...libraryKeys.all, "notes"] as const,
  list: (scopeId?: string, itemId?: string) =>
    libraryKeys.notes(scopeId, itemId),
  detail: (scopeId?: string, id?: string) =>
    [
      ...libraryKeys.all,
      "notes",
      normalizeScopeId(scopeId),
      "detail",
      id || "none",
    ] as const,
};

export const savedSearchKeys = {
  all: (scopeId?: string) => libraryKeys.savedSearches(scopeId),
  byId: (scopeId: string | undefined, id: string) =>
    [...libraryKeys.savedSearches(scopeId), id] as const,
  results: (
    scopeId: string | undefined,
    id: string,
    params?: Record<string, unknown>,
  ) => [...libraryKeys.savedSearches(scopeId), id, "results", params] as const,
};

export const relationKeys = {
  allByScope: (scopeId?: string) => libraryKeys.relationsAll(scopeId),
  all: (scopeId?: string, itemId?: string) =>
    libraryKeys.relations(scopeId, itemId),
};

export const attachmentKeys = {
  all: (scopeId?: string) => libraryKeys.attachmentsAll(scopeId),
  byItem: (scopeId?: string, itemId?: string) =>
    libraryKeys.attachments(scopeId, itemId),
};

export const ingestKeys = {
  all: (scopeId?: string) => libraryKeys.ingestion(scopeId),
  status: (scopeId?: string, runId?: string) =>
    libraryKeys.ingestionRun(scopeId, runId),
};

export const feedKeys = {
  all: libraryKeys.feeds(),
  subscriptions: () => libraryKeys.feedSubscriptions(),
  articles: (scopeId?: string, feedUrl?: string) =>
    libraryKeys.feedArticles(scopeId, feedUrl),
};

export const curationKeys = {
  duplicates: (scopeId?: string) => libraryKeys.duplicates(scopeId),
  integrity: (scopeId?: string) => libraryKeys.integrity(scopeId),
};

export const retractionKeys = {
  all: (scopeId?: string) => libraryKeys.retractions(scopeId),
  stats: (scopeId?: string) =>
    [...libraryKeys.retractions(scopeId), "stats"] as const,
  items: (scopeId?: string) =>
    [...libraryKeys.retractions(scopeId), "items"] as const,
};

export const citationKeys = {
  all: [...libraryKeys.all, "citation"] as const,
  styles: (scopeId?: string) =>
    [
      ...libraryKeys.all,
      "citation",
      "styles",
      normalizeScopeId(scopeId),
    ] as const,
  item: (
    scopeId?: string,
    itemId?: string,
    style: CslStyle = "apa",
    index: number = 1,
  ) => libraryKeys.citation(scopeId, itemId, style, index),
  batch: (scopeId?: string, itemIds: string[] = [], style: CslStyle = "apa") =>
    [
      ...libraryKeys.all,
      "citation",
      "batch",
      normalizeScopeId(scopeId),
      itemIds.join(","),
      style,
    ] as const,
};

export const exportKeys = {
  all: libraryKeys.exports(),
  collectionBundle: (scopeId?: string, collectionId?: string) =>
    [
      ...libraryKeys.exports(),
      "bundle",
      normalizeScopeId(scopeId),
      collectionId || "none",
    ] as const,
  collectionBibtex: (scopeId?: string, collectionId?: string) =>
    [
      ...libraryKeys.exports(),
      "bibtex",
      normalizeScopeId(scopeId),
      collectionId || "none",
    ] as const,
};

export function invalidateCollections(
  qc: {
    invalidateQueries: (filters: {
      queryKey: readonly unknown[];
    }) => Promise<unknown> | void;
  },
  scopeId?: string,
): void {
  qc.invalidateQueries({ queryKey: libraryKeys.collections(scopeId) });
  qc.invalidateQueries({ queryKey: itemKeys.counts(scopeId) });
}

/**
 * Unified Reader Query Keys mapped directly to libraryKeys
 */
export const readerQueryKeys = {
  all: libraryKeys.all,
  item: (scopeId?: string, itemId?: string) =>
    libraryKeys.item(scopeId, itemId),
  fulltext: (scopeId?: string, itemId?: string) =>
    libraryKeys.fulltext(scopeId, itemId),
  metadataSources: (scopeId?: string, itemId?: string) =>
    libraryKeys.itemMetadataSources(scopeId, itemId),
  annotations: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
  notes: (scopeId?: string, itemId?: string) =>
    libraryKeys.notes(scopeId, itemId),
  state: (scopeId?: string, itemId?: string) =>
    libraryKeys.itemState(scopeId, itemId),
  attachments: (scopeId?: string, itemId?: string) =>
    libraryKeys.attachments(scopeId, itemId),
  collections: (scopeId?: string) => libraryKeys.collections(scopeId),
  itemCollections: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "item-collections",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,
  tags: (scopeId?: string) => libraryKeys.tags(scopeId),
  itemTags: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "item-tags",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,
  relations: (scopeId?: string, itemId?: string) =>
    libraryKeys.relations(scopeId, itemId),
  citation: (scopeId?: string, itemId?: string, style?: string) =>
    libraryKeys.citation(scopeId, itemId, style),
  bibtex: (scopeId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "bibtex",
      normalizeScopeId(scopeId),
      itemId || "none",
    ] as const,
  styles: (query?: string) =>
    [...libraryKeys.all, "csl-styles", query || "all"] as const,
  itemTypes: () => libraryKeys.itemTypes(),
};

export const annotationKeys = {
  all: [...libraryKeys.all, "annotations"] as const,
  allByScope: (scopeId?: string) => libraryKeys.annotationsAll(scopeId),
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
};


