import type { SavedFeedSubscription } from '@/features/library/domain/types/ingestion.types';
import { ItemsService, RelationsService } from './clients/items.client';
import {
  CollectionsService,
  TagsService,
  NotesService,
  StateService,
  SavedSearchesService,
} from './clients/catalog-entities.client';
import {
  CitationService,
  ExportsService,
  AttachmentsService,
  UploadService,
  ExtractionTelemetryService,
  AnnotationsService,
} from './clients/citation-extraction.client';
import {
  IngestionService,
  CurationService,
  RetractionService,
  SearchService,
  SyncService,
  FeedsService,
} from './clients/ingestion-sync.client';

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
  getLibraryServiceHost,
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
  AttachmentsService,
  UploadService,
  ExtractionTelemetryService,
  AnnotationsService,
} from './clients/citation-extraction.client';

export {
  type FeedSubscriptionResponse,
  IngestionService,
  CurationService,
  RetractionService,
  SearchService,
  SyncService,
  FeedsService,
} from './clients/ingestion-sync.client';

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
  telemetry: ExtractionTelemetryService,
  annotations: AnnotationsService,
  ingestion: IngestionService,
  curation: CurationService,
  retraction: RetractionService,
  search: SearchService,
  sync: SyncService,
  feeds: FeedsService,
};

export default libraryServices;

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
  ) => Promise<SavedFeedSubscription>;
  onUpdateFeed?: (
    id: string,
    updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
  ) => Promise<void>;
  onRemoveFeed?: (id: string) => Promise<void>;
  getFeeds?: () => SavedFeedSubscription[];
}

let activeObserver: FeedHydrationObserver | null = null;
let draftCacheClearListener: ((groupKey?: string) => void) | null = null;

export function registerFeedHydrationObserver(observer: FeedHydrationObserver): void {
  activeObserver = observer;
}

export function registerDraftCacheClearListener(
  listener: (groupKey?: string) => void,
): void {
  draftCacheClearListener = listener;
}

export function notifyServerFeedsHydrated(feeds: SavedFeedSubscription[]): void {
  activeObserver?.onServerFeedsHydrated(feeds);
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
  draftCacheClearListener?.(groupKey);
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
  useFormatCitationMutation,
  useSearchCslStyles,
  useUploadCustomCslStyleMutation,
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
  useLibraryIntegrityReport,
  useQualityAudit,
  useMergeDuplicates,
  useAcademicFeedArticlesQuery,
  useFetchAcademicFeed,
  useFeedSubscriptionsQuery,
  useSubscribeFeedMutation,
  useUpdateFeedSubscriptionMutation,
  useUnsubscribeFeedMutation,
  usePreviewCaptureUrlMutation,
  type ConfirmCaptureUrlInput,
  useConfirmCaptureUrlMutation,
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
  useExtractNotesFromAnnotationsMutation,
} from './queries/tags-notes.queries';
