import type { SavedFeedSubscription } from '@/features/library/domain/types/ingestion.types';
import { ItemsService, RelationsService } from './clients/items.client';
import { CollectionsService, TagsService, NotesService, StateService, SavedSearchesService } from './clients/catalog-entities.client';
import { CitationService, ExportsService, AttachmentsService, UploadService, AnnotationsService } from './clients/attachments-annotations.client';
import { IngestionService, CurationService, RetractionService } from './clients/curation.client';
import type { SearchResponse, SearchSortBy, SearchSortOrder } from '@/features/library/domain/types/core.types';
import { libraryClient, resolveLibraryUrl, getSyncUrl, mapBackendItem } from '@/features/library/sdk/clients/http.client';

export * from './query-keys';

export {
  isProjectScope,
  getItemFileUrl,
  mapBackendItem,
  type TagWithCount,
  type ItemStateData,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
  type SavedSearchConditionGroup,
  type ReferenceData,
  type CslStyleMetadata,
  type LibrarySubdomain,
  SUBDOMAIN_ENV_HOSTS,
  getLibraryServiceHost,
  isTrustedOrigin,
  resolveLibraryUrl,
  resolveLibraryRawPath,
  libraryClient,
  sanitizeItemPayload,
  fetchPdfBlob,
} from './clients/http.client';

export {
  type ItemMetadataSourceItem,
  type ItemMetadataSourcesResponse,
  type ItemTypesResponse,
  type LibraryBootstrapResponse,
  ItemsService,
  RelationsService,
} from './clients/items.client';

export {
  type CreateNoteDTO,
  type UpdateNoteDTO,
  type ExtractNotesOptions,
  CollectionsService,
  TagsService,
  NotesService,
  StateService,
  SavedSearchesService,
} from './clients/catalog-entities.client';

export {
  CitationService,
  ExportsService,
} from './clients/attachments-annotations.client';
export {
  AttachmentsService,
  UploadService,
  AnnotationsService,
} from './clients/attachments-annotations.client';

export { IngestionService } from './clients/curation.client';
export { CurationService, RetractionService } from './clients/curation.client';

// ── Feed Hydration & Draft Cache Port ────────────────────────────────────────

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

export function unregisterFeedHydrationObserver(observer?: FeedHydrationObserver): void {
  if (!observer || activeObserver === observer) {
    activeObserver = null;
    lastHydratedFeedsKey = '';
  }
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

// ── Query & Mutation Hooks ───────────────────────────────────────────────────

export {
  type InvalidationClient,
  chunkUniqueIds,
  extractItemFromCacheData,
  mergeCachedItemWithPatch,
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  removeItemsFromCacheData,
  removeItemsFromScopeCaches,
  invalidateLibraryCatalogDependencies,
  invalidateLibraryScopeCatalog,
  resolveCachedItemFromScope,
  useLibraryCacheSynchronizer,
} from './queries/cache-patcher';
export {
  resolveCachedItemVersion,
  useUpdateLibraryItemMutation,
  useToggleStarItemMutation,
  useImportFromUserMutation,
  useCreateLibraryItemMutation,
  useReResolveItemMetadataMutation,
  useSetMyPublicationMutation,
} from './queries/item-mutations.queries';
export {
  useLibraryDeltaSync,
} from './queries/sync.queries';
export {
  useLibraryBootstrapQuery,
  useLibraryCountsQuery,
  useViewItems,
  type UseItemsOptions,
  useItems,
  useItemTypes,
  useItem,
  type LibraryItemsQueryResult,
  useLibrarySearchFacetsQuery,
  useLibraryItemsQuery,
  useLibraryItemDetailQuery,
} from './queries/catalog.queries';
export {
  type UseCollectionsScopeInput,
  useCollections,
  useCollectionsQuery,
  useCreateCollectionMutation,
  useDetachItemFromCollectionMutation,
  useBatchDetachItemsMutation,
  useMoveCollectionItemsMutation,
  useAssignCollectionItemsMutation,
} from './queries/collections.queries';
export {
  useCitationStyles,
  useCslCitation,
  useSearchCslStyles,
  useExportItemCitationQuery,
  useAttachments,
  useRenameAttachment,
  useBatchRenameAttachmentsMutation,
  useUploadAttachmentMutation,
  useDownloadAnnotatedPdfMutation,
} from './queries/extraction.queries';
export {
  type PollRunOutcome,
  type PollIngestionRunOptions,
  pollIngestionRunCompletion,
  buildIdentifierIngestionPayload,
  type TrackedIdentifierIngestionOptions,
  executeTrackedIdentifierIngestion,
  useTrackedIdentifierIngestion,
  useDuplicateGroups,
  useMergeDuplicates,
  useBatchMergeDuplicates,
  useFeedArticlesQuery,
  useFetchFeed,
  useFeedSubscriptionsQuery,
  useSubscribeFeedMutation,
  useUpdateFeedSubscriptionMutation,
  useUnsubscribeFeedMutation,
  useImportOpmlFeedsMutation,
  useExportOpmlFeedsMutation,
  useIngestMutation,
  useDismissDuplicatesMutation,
  invalidateRetraction,
  useRetractedItems,
  useRetraction,
  useSyncExternalBibtexMutation,
} from './queries/ingestion.queries';
export {
  type CreateAnnotationDTO,
  type UpdateAnnotationDTO,
  useReaderItem,
  useReaderFulltext,
  useAnnotations,
  useExportAnnotatedPdf,
  useOcrExtraction,
} from './queries/reader.queries';
export {
  invalidateSavedSearches,
  useSavedSearches,
  useSavedSearchResults,
  useRelations,
  type DroppedField,
  type FieldMappingChange,
  type CreatorRoleChange,
  type TypeConversionPreview,
  useItemTypeConversionPreviewQuery,
  useItemTypeConversion,
} from './queries/saved-searches-relations.queries';
export {
  useTrash,
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useTags,
  useNotes,
} from './queries/tags-notes.queries';

export const SearchService = {
  search: (
    params: {
      query?: string;
      q?: string;
      searchMode?: string;
      view?: string;
      limit?: number;
      page?: number;
      cursor?: string;
      collectionId?: string;
      includeSubcollections?: boolean;
      tagId?: string;
      tag?: string;
      itemType?: string;
      type?: string;
      yearFrom?: number;
      yearTo?: number;
      fromYear?: number;
      toYear?: number;
      hasFile?: boolean;
      hasNotes?: boolean;
      readStatus?: string;
      sortBy?: SearchSortBy | string;
      sortOrder?: SearchSortOrder | string;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      includeFacets?: boolean;
    },
    scopeId?: string,
    options?: { signal?: AbortSignal },
  ): Promise<SearchResponse> => {
    const effectiveQuery = params.query ?? params.q ?? '';
    const queryParams: Record<string, string> = { query: effectiveQuery };
    if (params.searchMode) queryParams.searchMode = params.searchMode;
    if (params.view) queryParams.view = params.view;
    if (params.limit !== undefined) queryParams.limit = String(params.limit);
    if (params.page !== undefined) queryParams.page = String(params.page);
    if (params.cursor) queryParams.cursor = params.cursor;
    if (params.collectionId) queryParams.collectionId = params.collectionId;
    if (params.includeSubcollections !== undefined) {
      queryParams.includeSubcollections = String(params.includeSubcollections);
    }
    if (params.tagId) queryParams.tagId = params.tagId;
    if (params.tag) queryParams.tag = params.tag;
    const effectiveItemType = params.itemType ?? params.type;
    if (effectiveItemType) queryParams.itemType = effectiveItemType;
    const effectiveYearFrom = params.yearFrom ?? params.fromYear;
    if (effectiveYearFrom !== undefined) {
      queryParams.yearFrom = String(effectiveYearFrom);
    }
    const effectiveYearTo = params.yearTo ?? params.toYear;
    if (effectiveYearTo !== undefined) {
      queryParams.yearTo = String(effectiveYearTo);
    }
    if (params.hasFile !== undefined) {
      queryParams.hasFile = String(params.hasFile);
    }
    if (params.hasNotes !== undefined) {
      queryParams.hasNotes = String(params.hasNotes);
    }
    if (params.readStatus) queryParams.readStatus = params.readStatus;
    const effectiveSortBy = params.sortBy ?? params.orderBy;
    if (effectiveSortBy) queryParams.sortBy = String(effectiveSortBy);
    const effectiveSortOrder = params.sortOrder ?? params.orderDirection;
    if (effectiveSortOrder) queryParams.sortOrder = String(effectiveSortOrder);
    if (params.includeFacets !== undefined) {
      queryParams.includeFacets = String(params.includeFacets);
    }

    return libraryClient
      .get<SearchResponse>(
        resolveLibraryUrl('search', '/search', scopeId),
        { params: queryParams, signal: options?.signal },
      )
      .then((res) => ({
        ...res,
        items: Array.isArray(res?.items)
          ? res.items.map((it) => mapBackendItem(it))
          : [],
      }));
  },

  searchAnchors: (
    attachmentId: string,
    term: string,
    pageIndex?: number,
    scopeId?: string,
    options?: { signal?: AbortSignal },
  ) => {
    const params: Record<string, string> = { term };
    if (pageIndex !== undefined) params.pageIndex = String(pageIndex);
    return libraryClient
      .get<
        Array<{
          attachmentId?: string;
          pageIndex: number;
          snippet?: string;
          text?: string;
          charOffsetStart?: number;
          charOffsetEnd?: number;
          startOffset?: number;
          endOffset?: number;
          highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
        }>
      >(
        resolveLibraryUrl(
          'search',
          `/search/attachments/${encodeURIComponent(attachmentId)}/anchors`,
          scopeId,
        ),
        { params, signal: options?.signal },
      )
      .then((rows) =>
        (Array.isArray(rows) ? rows : []).map((row) => {
          const snippet = row.snippet ?? row.text ?? '';
          const charOffsetStart = row.charOffsetStart ?? row.startOffset ?? 0;
          const charOffsetEnd = row.charOffsetEnd ?? row.endOffset ?? charOffsetStart;
          return {
            attachmentId: row.attachmentId ?? attachmentId,
            pageIndex: row.pageIndex,
            snippet,
            text: snippet,
            charOffsetStart,
            charOffsetEnd,
            startOffset: charOffsetStart,
            endOffset: charOffsetEnd,
            highlightBoxes: row.highlightBoxes,
          };
        }),
      );
  },
};

export const SyncService = {
  getDiagnostics: (scopeId?: string) =>
    libraryClient.get<unknown>(getSyncUrl(scopeId, 'diagnostics')),

  getVersion: (scopeId?: string) =>
    libraryClient.get<{ version: string; scope: 'user' | 'project'; scopeId: string }>(getSyncUrl(scopeId, 'version')),

  getChanges: (scopeId?: string, params?: { since?: string; limit?: number; compact?: boolean }) =>
    libraryClient.get<{
      since: string;
      count: number;
      compacted?: boolean;
      hasMore: boolean;
      nextCursor?: string | null;
      nextSince?: string | null;
      changes: Array<Record<string, unknown>>;
    }>(
      getSyncUrl(scopeId, 'changes'),
      {
        params: {
          since: params?.since ?? '0',
          limit: params?.limit ?? 100,
          ...(params?.compact !== undefined ? { compact: params.compact } : {}),
        },
      },
    ),

  getTombstones: (scopeId?: string, params?: { since?: string; limit?: number }) =>
    libraryClient.get<{ since: string; count: number; hasMore: boolean; tombstones: Array<Record<string, unknown>> }>(
      getSyncUrl(scopeId, 'tombstones'),
      {
        params: {
          ...(params?.since !== undefined ? { since: params.since } : {}),
          limit: params?.limit ?? 100,
        },
      },
    ),
};

export interface FeedSubscriptionResponse {
  id: string;
  userId?: string;
  feedId?: string;
  customTitle?: string | null;
  cleanupReadAfter?: number;
  cleanupUnreadAfter?: number;
  feed?: {
    id: string;
    url: string;
    title: string;
    siteUrl?: string | null;
    description?: string | null;
    lastFetchedAt?: string | null;
  };
}

export const FeedsService = {
  getSubscriptions: () =>
    libraryClient.get<{ data: FeedSubscriptionResponse[] }>(
      resolveLibraryUrl('ingestion', '/feeds/subscriptions'),
    ),

  subscribe: (data: {
    url: string;
    customTitle?: string;
    cleanupDays?: number;
    cleanupReadAfter?: number;
    cleanupUnreadAfter?: number;
  }) =>
    libraryClient.post<{ data: unknown }>(resolveLibraryUrl('ingestion', '/feeds/subscriptions'), data),

  updateSubscription: (
    feedId: string,
    data: {
      customTitle?: string;
      cleanupDays?: number;
      cleanupReadAfter?: number;
      cleanupUnreadAfter?: number;
      url?: string;
    },
  ) =>
    libraryClient.patch<{ data: unknown }>(resolveLibraryUrl('ingestion', `/feeds/subscriptions/${encodeURIComponent(feedId)}`), data),

  unsubscribe: (feedId: string) =>
    libraryClient.delete<void>(resolveLibraryUrl('ingestion', `/feeds/subscriptions/${encodeURIComponent(feedId)}`)),

  getItems: (
    feedId: string,
    params?: {
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number;
      cursor?: string;
      page?: number;
      search?: string;
      forceRefresh?: boolean;
    },
  ) =>
    libraryClient.get<{
      data: unknown[];
      meta?: {
        hasNextPage: boolean;
        nextCursor: string | null;
        limit: number;
      };
      hasNextPage?: boolean;
      nextCursor?: string | null;
    }>(
      resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/items`),
      { params },
    ),

  markItemRead: (itemId: string, isRead = true) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', `/feeds/items/${encodeURIComponent(itemId)}/read`), { isRead }),

  markAllRead: (itemIds: string[]) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', '/feeds/items/mark-all-read'), { itemIds }),

  markFeedAllRead: (feedId: string) =>
    libraryClient.post<{ success: boolean; markedCount?: number }>(
      resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/mark-all-read`),
      {},
    ),

  exportOpml: () =>
    libraryClient.get<{ data: { opmlXml: string; count: number } }>(
      resolveLibraryUrl('ingestion', '/feeds/opml/export'),
    ),

  importOpml: (opmlXml: string) =>
    libraryClient.post<{
      data: {
        importedCount: number;
        totalParsed: number;
        subscriptions: FeedSubscriptionResponse[];
      };
    }>(resolveLibraryUrl('ingestion', '/feeds/opml/import'), { opmlXml }),
};

export const libraryServices = {
  items: ItemsService,
  collections: CollectionsService,
  tags: TagsService,
  notes: NotesService,
  state: StateService,
  savedSearches: SavedSearchesService,
  relations: RelationsService,
  citations: CitationService,
  exports: ExportsService,
  attachments: AttachmentsService,
  upload: UploadService,
  annotations: AnnotationsService,
  ingestion: IngestionService,
  curation: CurationService,
  retraction: RetractionService,
  search: SearchService,
  sync: SyncService,
  feeds: FeedsService,
};

export default libraryServices;
