import type { CslStyle } from "@/features/library/types/core.types";
import type { SavedFeedSubscription } from "@/features/library/types/ingestion.types";

/**
 * Centralized TanStack Query Keys for features/library
 * Following Supabase Studio pattern for strict key isolation and single source of truth.
 */
const DEFAULT_SCOPE = "user";

export function normalizeSpaceId(spaceId?: string | null): string {
  return !spaceId || spaceId === "me" || spaceId === "personal" ? DEFAULT_SCOPE : spaceId;
}

export const libraryKeys = {
  all: ["library"] as const,

  // Workspace & Document Reader Bootstrap
  bootstrap: (spaceId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "bootstrap",
      normalizeSpaceId(spaceId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,
  readerBootstrap: (spaceId?: string, itemId?: string, attachmentId?: string) =>
    [
      ...libraryKeys.all,
      "reader-bootstrap",
      normalizeSpaceId(spaceId),
      itemId || "none",
      attachmentId || "primary",
    ] as const,

  // Items
  items: (spaceId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeSpaceId(spaceId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,
  counts: (spaceId?: string) =>
    [...libraryKeys.all, "counts", normalizeSpaceId(spaceId)] as const,
  item: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeSpaceId(spaceId),
      "detail",
      itemId || "none",
    ] as const,
  fulltext: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "fulltext",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,
  itemState: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "item-state",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,
  itemTypes: (spaceId?: string) =>
    [...libraryKeys.all, "item-types", normalizeSpaceId(spaceId)] as const,
  typeConversionPreview: (
    spaceId?: string,
    itemId?: string,
    targetType?: string,
  ) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeSpaceId(spaceId),
      "type-conversion-preview",
      itemId || "none",
      targetType || "none",
    ] as const,

  // Collections (Folder Tree & Flat List)
  collections: (spaceId?: string) =>
    [...libraryKeys.all, "collections", normalizeSpaceId(spaceId)] as const,
  collection: (spaceId?: string, collectionId?: string) =>
    [
      ...libraryKeys.all,
      "collections",
      normalizeSpaceId(spaceId),
      "detail",
      collectionId || "none",
    ] as const,

  // Tags
  tags: (spaceId?: string) =>
    [...libraryKeys.all, "tags", normalizeSpaceId(spaceId)] as const,

  // Attachments & Annotations
  attachmentsAll: (spaceId?: string) =>
    [...libraryKeys.all, "attachments", normalizeSpaceId(spaceId)] as const,
  attachments: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "attachments",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,
  annotationsAll: (spaceId?: string) =>
    [...libraryKeys.all, "annotations", normalizeSpaceId(spaceId)] as const,
  annotations: (spaceId?: string, attachmentId?: string) =>
    [
      ...libraryKeys.all,
      "annotations",
      normalizeSpaceId(spaceId),
      attachmentId || "none",
    ] as const,

  // Notes
  notes: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "notes",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,

  // Relations
  relationsAll: (spaceId?: string) =>
    [...libraryKeys.all, "relations", normalizeSpaceId(spaceId)] as const,
  relations: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "relations",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,

  // Saved Searches
  savedSearches: (spaceId?: string) =>
    [...libraryKeys.all, "saved-searches", normalizeSpaceId(spaceId)] as const,

  // Curation: Duplicates, Integrity & Retractions
  duplicates: (spaceId?: string) =>
    [...libraryKeys.all, "duplicates", normalizeSpaceId(spaceId)] as const,
  integrity: (spaceId?: string) =>
    [
      ...libraryKeys.all,
      "curation",
      normalizeSpaceId(spaceId),
      "integrity",
    ] as const,
  retractions: (spaceId?: string) =>
    [...libraryKeys.all, "retractions", normalizeSpaceId(spaceId)] as const,

  // Citations & Exports
  citation: (
    spaceId?: string,
    itemId?: string,
    style?: string,
    index?: number,
  ) =>
    [
      ...libraryKeys.all,
      "citation",
      normalizeSpaceId(spaceId),
      itemId || "none",
      style || "apa",
      index ?? 1,
    ] as const,
  exports: () => [...libraryKeys.all, "exports"] as const,

  // Search
  search: () => [...libraryKeys.all, "search"] as const,
  searchFacets: (spaceId?: string, params?: unknown) =>
    [
      ...libraryKeys.all,
      "search-facets",
      normalizeSpaceId(spaceId),
      (params ?? {}) as Record<string, unknown>,
    ] as const,
  searchAnchors: (
    spaceId?: string,
    attachmentId?: string,
    term?: string,
    pageIndex?: number,
  ) =>
    [
      ...libraryKeys.all,
      "search-anchors",
      normalizeSpaceId(spaceId),
      attachmentId || "none",
      term || "",
      pageIndex ?? "all",
    ] as const,

  // Sync (Distributed Replication CDC)
  syncVersion: (spaceId?: string) =>
    [...libraryKeys.all, "sync-version", normalizeSpaceId(spaceId)] as const,

  // Ingestion
  ingestion: (spaceId?: string) =>
    [...libraryKeys.all, "ingest", normalizeSpaceId(spaceId)] as const,
  ingestionRun: (spaceId?: string, runId?: string) =>
    [
      ...libraryKeys.all,
      "ingest",
      normalizeSpaceId(spaceId),
      runId || "none",
    ] as const,

  // Feeds
  feeds: () => [...libraryKeys.all, "feeds"] as const,
  feedSubscriptions: (spaceId?: string) =>
    spaceId
      ? ([...libraryKeys.all, "feeds", "subscriptions", normalizeSpaceId(spaceId)] as const)
      : ([...libraryKeys.all, "feeds", "subscriptions"] as const),
  feedArticles: (spaceId?: string, feedUrl?: string) =>
    [
      ...libraryKeys.all,
      "feeds",
      normalizeSpaceId(spaceId),
      "articles",
      feedUrl || "none",
    ] as const,
};

/**
 * Domain-specific key factories mapped directly to canonical libraryKeys
 */
export const itemKeys = {
  all: (spaceId?: string) =>
    [...libraryKeys.all, "items", normalizeSpaceId(spaceId)] as const,
  byId: (spaceId?: string, itemId?: string) =>
    libraryKeys.item(spaceId, itemId),
  byCollection: (spaceId?: string, collectionId?: string) =>
    [
      ...libraryKeys.all,
      "items",
      normalizeSpaceId(spaceId),
      "by-collection",
      collectionId || "none",
    ] as const,
  byView: (spaceId?: string, view?: string, search?: string) =>
    libraryKeys.items(spaceId, { view: view || "all", search: search || "" }),
  trash: (spaceId?: string) => libraryKeys.items(spaceId, { view: "trash" }),
  state: (spaceId?: string, itemId?: string) =>
    libraryKeys.itemState(spaceId, itemId),
  types: (spaceId?: string) => libraryKeys.itemTypes(spaceId),
  typeConversionPreview: (
    spaceId?: string,
    itemId?: string,
    targetType?: string,
  ) => libraryKeys.typeConversionPreview(spaceId, itemId, targetType),
  counts: (spaceId?: string) => libraryKeys.counts(spaceId),
};

export const collectionKeys = {
  all: (spaceId?: string) => libraryKeys.collections(spaceId),
  byId: (spaceId?: string, collectionId?: string) =>
    libraryKeys.collection(spaceId, collectionId),
};

export const tagKeys = {
  all: [...libraryKeys.all, "tags"] as const,
  list: (spaceId?: string) => libraryKeys.tags(spaceId),
};

export const noteKeys = {
  all: (spaceId?: string) =>
    [...libraryKeys.all, "notes", normalizeSpaceId(spaceId)] as const,
  lists: () => [...libraryKeys.all, "notes"] as const,
  list: (spaceId?: string, itemId?: string) =>
    libraryKeys.notes(spaceId, itemId),
  detail: (spaceId?: string, id?: string) =>
    [
      ...libraryKeys.all,
      "notes",
      normalizeSpaceId(spaceId),
      "detail",
      id || "none",
    ] as const,
};

export const savedSearchKeys = {
  all: (spaceId?: string) => libraryKeys.savedSearches(spaceId),
  byId: (spaceId: string | undefined, id: string) =>
    [...libraryKeys.savedSearches(spaceId), id] as const,
  results: (
    spaceId: string | undefined,
    id: string,
    params?: Record<string, unknown>,
  ) => [...libraryKeys.savedSearches(spaceId), id, "results", params] as const,
};

export const relationKeys = {
  all: (spaceId?: string, itemId?: string) =>
    libraryKeys.relations(spaceId, itemId),
};

export const attachmentKeys = {
  all: (spaceId?: string) => libraryKeys.attachmentsAll(spaceId),
  byItem: (spaceId?: string, itemId?: string) =>
    libraryKeys.attachments(spaceId, itemId),
};

export const ingestKeys = {
  all: (spaceId?: string) => libraryKeys.ingestion(spaceId),
  status: (spaceId?: string, runId?: string) =>
    libraryKeys.ingestionRun(spaceId, runId),
};

export const feedKeys = {
  all: libraryKeys.feeds(),
  subscriptions: (spaceId?: string) => libraryKeys.feedSubscriptions(spaceId),
  articles: (spaceId?: string, feedUrl?: string) =>
    libraryKeys.feedArticles(spaceId, feedUrl),
};

export const curationKeys = {
  duplicates: (spaceId?: string) => libraryKeys.duplicates(spaceId),
  integrity: (spaceId?: string) => libraryKeys.integrity(spaceId),
};

export const retractionKeys = {
  all: (spaceId?: string) => libraryKeys.retractions(spaceId),
  stats: (spaceId?: string) =>
    [...libraryKeys.retractions(spaceId), "stats"] as const,
  items: (spaceId?: string) =>
    [...libraryKeys.retractions(spaceId), "items"] as const,
};

export const citationKeys = {
  all: [...libraryKeys.all, "citation"] as const,
  styles: (spaceId?: string) =>
    [
      ...libraryKeys.all,
      "citation",
      "styles",
      normalizeSpaceId(spaceId),
    ] as const,
  item: (
    spaceId?: string,
    itemId?: string,
    style: CslStyle = "apa",
    index: number = 1,
  ) => libraryKeys.citation(spaceId, itemId, style, index),
  batch: (spaceId?: string, itemIds: string[] = [], style: CslStyle = "apa") =>
    [
      ...libraryKeys.all,
      "citation",
      "batch",
      normalizeSpaceId(spaceId),
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
  spaceId?: string,
): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: libraryKeys.collections(spaceId) }),
    qc.invalidateQueries({ queryKey: itemKeys.counts(spaceId) }),
  ]);
}

/**
 * Unified Reader Query Keys mapped directly to libraryKeys
 */
export const readerQueryKeys = {
  all: libraryKeys.all,
  bootstrap: (spaceId?: string, itemId?: string, attachmentId?: string) =>
    libraryKeys.readerBootstrap(spaceId, itemId, attachmentId),
  item: (spaceId?: string, itemId?: string) =>
    libraryKeys.item(spaceId, itemId),
  fulltext: (spaceId?: string, itemId?: string) =>
    libraryKeys.fulltext(spaceId, itemId),
  annotations: (spaceId?: string, attachmentId?: string) =>
    libraryKeys.annotations(spaceId, attachmentId),
  notes: (spaceId?: string, itemId?: string) =>
    libraryKeys.notes(spaceId, itemId),
  state: (spaceId?: string, itemId?: string) =>
    libraryKeys.itemState(spaceId, itemId),
  attachments: (spaceId?: string, itemId?: string) =>
    libraryKeys.attachments(spaceId, itemId),
  collections: (spaceId?: string) => libraryKeys.collections(spaceId),
  tags: (spaceId?: string) => libraryKeys.tags(spaceId),
  itemTags: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "item-tags",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,
  relations: (spaceId?: string, itemId?: string) =>
    libraryKeys.relations(spaceId, itemId),
  citation: (spaceId?: string, itemId?: string, style?: string) =>
    libraryKeys.citation(spaceId, itemId, style),
  bibtex: (spaceId?: string, itemId?: string) =>
    [
      ...libraryKeys.all,
      "bibtex",
      normalizeSpaceId(spaceId),
      itemId || "none",
    ] as const,
  styles: (query?: string) =>
    [...libraryKeys.all, "csl-styles", query || "all"] as const,
  itemTypes: () => libraryKeys.itemTypes(),
};

export const annotationKeys = {
  all: [...libraryKeys.all, "annotations"] as const,
  byAttachment: (spaceId?: string, attachmentId?: string) =>
    libraryKeys.annotations(spaceId, attachmentId),
};

export function getReaderBootstrapScope(spaceId?: string | null): string {
  return `reader:${normalizeSpaceId(spaceId)}`;
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
 * mounting before `LibraryPage`) still await the upcoming `/bootstrap` request
 * instead of firing duplicate individual HTTP requests.
 */
export function prepareBootstrapScope(
  queryClient: object,
  spaceId?: string,
): void {
  const scope = normalizeSpaceId(spaceId);
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
  spaceId: string | undefined,
  promise: Promise<T>,
): Promise<T> {
  const scope = normalizeSpaceId(spaceId);
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
  spaceId?: string,
): Promise<unknown> | undefined {
  return activeBootstrapPromises.get(queryClient)?.get(normalizeSpaceId(spaceId));
}

export async function waitForBootstrapCache<T>(
  queryClient: {
    getQueryData: <D>(key: readonly unknown[]) => D | undefined;
    getQueryState?: (key: readonly unknown[]) => { dataUpdatedAt?: number } | undefined;
  },
  spaceId: string | undefined,
  cacheKey: readonly unknown[],
): Promise<T | undefined> {
  await Promise.resolve();
  const pending = getActiveBootstrapPromise(queryClient, spaceId);
  if (pending) {
    const updatedBefore = queryClient.getQueryState?.(cacheKey)?.dataUpdatedAt ?? 0;
    try {
      await pending;
    } catch {
      return undefined;
    }
    const latestPending = getActiveBootstrapPromise(queryClient, spaceId);
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

let fallbackFeeds: SavedFeedSubscription[] = [];

const defaultFeedHydrationObserver: FeedHydrationObserver = {
  onServerFeedsHydrated: (feeds) => {
    fallbackFeeds = Array.isArray(feeds) ? [...feeds] : [];
  },
  onReadEntriesHydrated: () => {},
  onLoadFeedsFallback: async () => fallbackFeeds,
  onAddFeed: (name, url, retentionDays = 30, options) => {
    const trimmedUrl = url.trim();
    const trimmedName =
      name.trim() || trimmedUrl.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 42);
    const unreadDays = options?.cleanupUnreadAfter ?? retentionDays ?? 30;
    const readDays = options?.cleanupReadAfter ?? 7;
    const created: SavedFeedSubscription = {
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      url: trimmedUrl,
      retentionDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    };
    fallbackFeeds = [...fallbackFeeds.filter((f) => f.id !== created.id), created];
    return created;
  },
  onUpdateFeed: async (id, updates) => {
    fallbackFeeds = fallbackFeeds.map((f) =>
      f.id === id ? { ...f, ...updates } : f,
    );
  },
  onRemoveFeed: async (id) => {
    fallbackFeeds = fallbackFeeds.filter((f) => f.id !== id);
  },
  getFeeds: () => fallbackFeeds,
};

function getEffectiveFeedObserver(): FeedHydrationObserver {
  return activeObserver ?? defaultFeedHydrationObserver;
}

export function notifyServerFeedsHydrated(feeds: SavedFeedSubscription[]): void {
  const observer = getEffectiveFeedObserver();
  if (!Array.isArray(feeds)) return;
  const nextKey = feeds
    .map(
      (f) =>
        `${f.id}|${f.name}|${f.url}|${f.retentionDays ?? ''}|${f.cleanupReadAfter ?? ''}|${f.cleanupUnreadAfter ?? ''}`,
    )
    .join(';;');
  if (nextKey === lastHydratedFeedsKey && (observer.getFeeds?.()?.length ?? 0) === feeds.length) {
    return;
  }
  lastHydratedFeedsKey = nextKey;
  observer.onServerFeedsHydrated(feeds);
}

export function notifyReadEntriesHydrated(entryIds: Iterable<string>): void {
  getEffectiveFeedObserver().onReadEntriesHydrated(entryIds);
}

export async function invokeLoadFeedsFallback(options?: {
  force?: boolean;
}): Promise<SavedFeedSubscription[]> {
  const observer = getEffectiveFeedObserver();
  if (observer.onLoadFeedsFallback) {
    return observer.onLoadFeedsFallback(options);
  }
  return observer.getFeeds?.() ?? [];
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
  const observer = getEffectiveFeedObserver();
  if (!observer.onAddFeed) {
    return defaultFeedHydrationObserver.onAddFeed!(name, url, retentionDays, options);
  }
  return observer.onAddFeed(name, url, retentionDays, options);
}

export async function invokeUpdateFeed(
  id: string,
  updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
): Promise<void> {
  await getEffectiveFeedObserver().onUpdateFeed?.(id, updates);
}

export async function invokeRemoveFeed(id: string): Promise<void> {
  await getEffectiveFeedObserver().onRemoveFeed?.(id);
}

export function getRegisteredFeedsSnapshot(): SavedFeedSubscription[] {
  return getEffectiveFeedObserver().getFeeds?.() ?? [];
}

export function notifyDraftCacheCleared(groupKey?: string): void {
  draftCacheClearListeners.forEach((listener) => listener(groupKey));
}




