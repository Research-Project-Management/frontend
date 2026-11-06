import type { CslStyle } from "@/features/library/types/core.types";
import type { SavedFeedSubscription } from "@/features/library/types/ingestion.types";

/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation and single source of truth.
 */
const DEFAULT_SCOPE = "user";

export function normalizeScopeId(scopeId?: string | null): string {
  return !scopeId || scopeId === "me" || scopeId === "personal" ? DEFAULT_SCOPE : scopeId;
}

export const libraryKeys = {
  all: ["library"] as const,

  // Workspace & Document Reader Bootstrap
  bootstrap: (scopeId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "bootstrap",
      normalizeScopeId(scopeId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,
  readerBootstrap: (scopeId?: string, itemId?: string, attachmentId?: string) =>
    [
      ...libraryKeys.all,
      "reader-bootstrap",
      normalizeScopeId(scopeId),
      itemId || "none",
      attachmentId || "primary",
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
      "collections",
      normalizeScopeId(scopeId),
      "detail",
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
      index ?? 1,
    ] as const,
  exports: () => [...libraryKeys.all, "exports"] as const,

  // Search
  search: () => [...libraryKeys.all, "search"] as const,
  searchFacets: (scopeId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "search-facets",
      normalizeScopeId(scopeId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,
  searchAnchors: (
    scopeId?: string,
    attachmentId?: string,
    term?: string,
    pageIndex?: number,
  ) =>
    [
      ...libraryKeys.all,
      "search-anchors",
      normalizeScopeId(scopeId),
      attachmentId || "none",
      term || "",
      pageIndex ?? "all",
    ] as const,

  // Sync (Distributed Replication CDC)
  syncVersion: (scopeId?: string) =>
    [...libraryKeys.all, "sync-version", normalizeScopeId(scopeId)] as const,

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
    [
      ...libraryKeys.all,
      "items",
      normalizeScopeId(scopeId),
      "by-collection",
      collectionId || "none",
    ] as const,
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
};

export function invalidateCollections(
  qc: {
    invalidateQueries: (filters: {
      queryKey: readonly unknown[];
    }) => Promise<unknown> | void;
  },
  scopeId?: string,
): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: libraryKeys.collections(scopeId) }),
    qc.invalidateQueries({ queryKey: itemKeys.counts(scopeId) }),
  ]);
}

/**
 * Unified Reader Query Keys mapped directly to libraryKeys
 */
export const readerQueryKeys = {
  all: libraryKeys.all,
  bootstrap: (scopeId?: string, itemId?: string, attachmentId?: string) =>
    libraryKeys.readerBootstrap(scopeId, itemId, attachmentId),
  item: (scopeId?: string, itemId?: string) =>
    libraryKeys.item(scopeId, itemId),
  fulltext: (scopeId?: string, itemId?: string) =>
    libraryKeys.fulltext(scopeId, itemId),
  annotations: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
  notes: (scopeId?: string, itemId?: string) =>
    libraryKeys.notes(scopeId, itemId),
  state: (scopeId?: string, itemId?: string) =>
    libraryKeys.itemState(scopeId, itemId),
  attachments: (scopeId?: string, itemId?: string) =>
    libraryKeys.attachments(scopeId, itemId),
  collections: (scopeId?: string) => libraryKeys.collections(scopeId),
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
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    libraryKeys.annotations(scopeId, attachmentId),
};

export function getReaderBootstrapScope(scopeId?: string | null): string {
  return `reader:${normalizeScopeId(scopeId)}`;
}

interface BootstrapDeferredGate {
  promise: Promise<unknown>;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}

const activeBootstrapPromises = new WeakMap<object, Map<string, Promise<unknown>>>();
const pendingBootstrapGates = new WeakMap<object, Map<string, BootstrapDeferredGate>>();

/**
 * Synchronously pre-registers a short-lived bootstrap gate during the render phase
 * so sibling components that mount earlier in the React tree (e.g. `LibrarySidebar`
 * mounting before `ModernLibraryPage`) still await the upcoming `/bootstrap` request
 * instead of firing duplicate individual HTTP requests.
 */
export function prepareBootstrapScope(
  queryClient: object,
  scopeId?: string,
): void {
  const scope = normalizeScopeId(scopeId);
  let promiseMap = activeBootstrapPromises.get(queryClient);
  if (!promiseMap) {
    promiseMap = new Map<string, Promise<unknown>>();
    activeBootstrapPromises.set(queryClient, promiseMap);
  }
  if (promiseMap.has(scope)) {
    return;
  }

  let gateMap = pendingBootstrapGates.get(queryClient);
  if (!gateMap) {
    gateMap = new Map<string, BootstrapDeferredGate>();
    pendingBootstrapGates.set(queryClient, gateMap);
  }

  let resolveGate!: () => void;
  const gatePromise = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });

  const timer = setTimeout(() => {
    gateMap?.delete(scope);
    if (promiseMap?.get(scope) === gatePromise) {
      promiseMap.delete(scope);
    }
    resolveGate();
  }, 250);

  gateMap.set(scope, {
    promise: gatePromise,
    resolve: resolveGate,
    timer,
  });
  promiseMap.set(scope, gatePromise);
}

export function registerBootstrapPromise<T>(
  queryClient: object,
  scopeId: string | undefined,
  promise: Promise<T>,
): Promise<T> {
  const scope = normalizeScopeId(scopeId);
  let map = activeBootstrapPromises.get(queryClient);
  if (!map) {
    map = new Map<string, Promise<unknown>>();
    activeBootstrapPromises.set(queryClient, map);
  }

  const gateMap = pendingBootstrapGates.get(queryClient);
  const existingGate = gateMap?.get(scope);
  if (existingGate) {
    clearTimeout(existingGate.timer);
    gateMap?.delete(scope);
  }

  const tracked = promise.finally(() => {
    if (map?.get(scope) === tracked) {
      map.delete(scope);
    }
    existingGate?.resolve();
  });
  map.set(scope, tracked);
  return tracked;
}

function getActiveBootstrapPromise(
  queryClient: object,
  scopeId?: string,
): Promise<unknown> | undefined {
  return activeBootstrapPromises.get(queryClient)?.get(normalizeScopeId(scopeId));
}

export async function waitForBootstrapCache<T>(
  queryClient: {
    getQueryData: <D>(key: readonly unknown[]) => D | undefined;
    getQueryState?: (key: readonly unknown[]) => { dataUpdatedAt?: number } | undefined;
  },
  scopeId: string | undefined,
  cacheKey: readonly unknown[],
): Promise<T | undefined> {
  await Promise.resolve();
  const pending = getActiveBootstrapPromise(queryClient, scopeId);
  if (pending) {
    const updatedBefore = queryClient.getQueryState?.(cacheKey)?.dataUpdatedAt ?? 0;
    try {
      await pending;
    } catch {
      return undefined;
    }
    const latestPending = getActiveBootstrapPromise(queryClient, scopeId);
    if (latestPending && latestPending !== pending) {
      try {
        await latestPending;
      } catch {
        return undefined;
      }
    }
    const updatedAfter = queryClient.getQueryState?.(cacheKey)?.dataUpdatedAt ?? 0;
    if (updatedBefore > 0 && updatedAfter <= updatedBefore) {
      return undefined;
    }
    return queryClient.getQueryData<T>(cacheKey);
  }
  return undefined;
}

export interface FeedHydrationObserver {
  onServerFeedsHydrated: (feeds: SavedFeedSubscription[]) => void;
  onReadEntriesHydrated: (entryIds: Iterable<string>) => void;
  onLoadFeedsFallback?: (options?: { force?: boolean }) => Promise<SavedFeedSubscription[]>;
  onAddFeed?: (
    name: string,
    url: string,
    retentionDays?: SavedFeedSubscription['retentionDays'],
    options?: {
      cleanupReadAfter?: SavedFeedSubscription['cleanupReadAfter'];
      cleanupUnreadAfter?: SavedFeedSubscription['cleanupUnreadAfter'];
    },
  ) => Promise<SavedFeedSubscription> | SavedFeedSubscription;
  onUpdateFeed?: (
    id: string,
    updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
  ) => Promise<void>;
  onRemoveFeed?: (id: string) => Promise<void>;
  getFeeds?: () => SavedFeedSubscription[];
}

export type DraftCacheClearListener = (groupKey?: string) => void;

let activeObserver: FeedHydrationObserver | null = null;
let lastHydratedFeedsKey = '';
const draftCacheClearListeners = new Set<DraftCacheClearListener>();

export function registerFeedHydrationObserver(
  observer: FeedHydrationObserver,
): () => void {
  activeObserver = observer;
  return () => {
    if (activeObserver === observer) {
      activeObserver = null;
      lastHydratedFeedsKey = '';
    }
  };
}

export function registerDraftCacheClearListener(
  listener: DraftCacheClearListener,
): () => void {
  draftCacheClearListeners.add(listener);
  return () => {
    draftCacheClearListeners.delete(listener);
  };
}

export function notifyServerFeedsHydrated(feeds: SavedFeedSubscription[]): void {
  if (!activeObserver || !Array.isArray(feeds)) return;
  const nextKey = feeds
    .map(
      (f) =>
        `${f.id}|${f.name}|${f.url}|${f.retentionDays ?? ''}|${f.cleanupReadAfter ?? ''}|${f.cleanupUnreadAfter ?? ''}`,
    )
    .join(';;');
  if (nextKey === lastHydratedFeedsKey && (activeObserver.getFeeds?.()?.length ?? 0) === feeds.length) {
    return;
  }
  lastHydratedFeedsKey = nextKey;
  activeObserver.onServerFeedsHydrated(feeds);
}

export function notifyReadEntriesHydrated(entryIds: Iterable<string>): void {
  activeObserver?.onReadEntriesHydrated(entryIds);
}

export async function invokeLoadFeedsFallback(options?: {
  force?: boolean;
}): Promise<SavedFeedSubscription[]> {
  if (activeObserver?.onLoadFeedsFallback) {
    return activeObserver.onLoadFeedsFallback(options);
  }
  return activeObserver?.getFeeds?.() ?? [];
}

export async function invokeAddFeed(
  name: string,
  url: string,
  retentionDays?: SavedFeedSubscription['retentionDays'],
  options?: {
    cleanupReadAfter?: SavedFeedSubscription['cleanupReadAfter'];
    cleanupUnreadAfter?: SavedFeedSubscription['cleanupUnreadAfter'];
  },
): Promise<SavedFeedSubscription> {
  if (!activeObserver?.onAddFeed) {
    throw new Error('FeedHydrationObserver.onAddFeed is not registered');
  }
  return activeObserver.onAddFeed(name, url, retentionDays, options);
}

export async function invokeUpdateFeed(
  id: string,
  updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
): Promise<void> {
  await activeObserver?.onUpdateFeed?.(id, updates);
}

export async function invokeRemoveFeed(id: string): Promise<void> {
  await activeObserver?.onRemoveFeed?.(id);
}

export function getRegisteredFeedsSnapshot(): SavedFeedSubscription[] {
  return activeObserver?.getFeeds?.() ?? [];
}

export function notifyDraftCacheCleared(groupKey?: string): void {
  draftCacheClearListeners.forEach((listener) => listener(groupKey));
}




