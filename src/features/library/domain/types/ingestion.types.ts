import { z } from 'zod';
import { itemSchema } from './items.types';

// ── Batch Upload & Progress ──────────────────────────────────────────────────
export interface IngestionProgressItem {
  id: string;
  title: string;
  status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'PROCESSING' | 'UPLOADING' | 'PENDING';
  itemId?: string;
  error?: string;
  itemName?: string;
}

export interface IngestionProgressResponse {
  runId: string;
  scopeId?: string;
  projectId?: string;
  userId?: string;
  status: string;
  total: number;
  processed: number;
  percentage: number;
  succeeded: number;
  duplicates: number;
  failed: number;
  currentTitle?: string;
  items: IngestionProgressItem[];
  startedAt: string;
  completedAt?: string;
}

export interface ProcessModalState {
  isOpen: boolean;
  isMinimized: boolean;
  runId: string | null;
  fileName: string;
  data: IngestionProgressResponse | null;
  isComplete: boolean;
  error: string | null;
}

export interface ProcessingFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  scopeId: string;
  collectionId?: string;
  status: 'UPLOADING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  progress: number;
  extractedTitle?: string;
  itemId?: string;
  fileId?: string;
  fileUrl?: string;
  createdAt: string;
  error?: string;
}

export interface InvalidationClient {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | void;
  refetchQueries?: (filters: {
    queryKey: readonly unknown[];
    type?: 'active' | 'inactive' | 'all';
  }) => Promise<unknown> | void;
}

export interface ProcessBatchUploadOptions {
  scopeId?: string;
  collectionId?: string;
  queryClient: InvalidationClient;
  onSuccess?: () => void;
  abortSignal?: AbortSignal;
}

export interface IngestionRunStatus extends Partial<IngestionProgressResponse> {
  totalItems?: number;
  processedItems?: number;
  failedItems?: number;
  lastError?: string | null;
  errorMessage?: string | null;
}

export interface ProcessModalStoreApi {
  getState: () => {
    state: ProcessModalState;
    processingItems: ProcessingFileItem[];
  };
  setState: (
    partial:
      | Partial<{ state: ProcessModalState; processingItems: ProcessingFileItem[] }>
      | ((s: { state: ProcessModalState; processingItems: ProcessingFileItem[] }) => Partial<{
          state: ProcessModalState;
          processingItems: ProcessingFileItem[];
        }>),
  ) => void;
  initializeBatchRun: (
    runId: string,
    fileName: string,
    items: IngestionProgressItem[],
    autoMinimizeOrOptions?:
      | boolean
      | {
          autoMinimize?: boolean;
          scopeId?: string;
          currentTitle?: string;
          initialProcessingItems?: ProcessingFileItem[];
        },
  ) => void;
  applyServerRunSnapshot: (run: Partial<IngestionRunStatus>, fallbackTotal?: number) => void;
  patchBatchItemAndRecalculate: (
    matcher: string | number,
    patch: Partial<IngestionProgressItem>,
    options?: {
      currentTitle?: string;
      processingPatch?: Partial<ProcessingFileItem>;
      removeProcessingItem?: boolean;
    },
  ) => void;
  completeBatchRun: (error?: string | null, provisionalIdsToRemove?: Iterable<string>) => void;
  clearProcessingItemsByIds: (ids: Iterable<string>) => void;
  updateProcessingItem: (id: string, updates: Partial<ProcessingFileItem>) => void;
  dismissProcessingItem: (id: string) => void;
}

export type ProcessModalStoreAdapter = ProcessModalStoreApi;

// ── Feeds ────────────────────────────────────────────────────────────────────
export type FeedReadFilterType = 'all' | 'unread' | 'read';

export const feedRetentionDaysSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(3),
  z.literal(7),
  z.literal(14),
  z.literal(30),
  z.literal(90),
]);

export type FeedRetentionDays = z.infer<typeof feedRetentionDaysSchema>;

export const savedFeedSubscriptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  lastRefreshed: z.string().optional(),
  retentionDays: feedRetentionDaysSchema.optional().default(30),
  cleanupReadAfter: feedRetentionDaysSchema.optional().default(7),
  cleanupUnreadAfter: feedRetentionDaysSchema.optional().default(30),
});

export type SavedFeedSubscription = z.infer<typeof savedFeedSubscriptionSchema>;

export interface RetentionOption {
  value: FeedRetentionDays;
  label: string;
}

export const READ_RETENTION_OPTIONS: RetentionOption[] = [
  { value: 7, label: 'After 7 days' },
  { value: 1, label: 'After 1 day' },
  { value: 3, label: 'After 3 days' },
  { value: 14, label: 'After 14 days' },
  { value: 30, label: 'After 30 days' },
  { value: 0, label: 'Never' },
];

export const UNREAD_RETENTION_OPTIONS: RetentionOption[] = [
  { value: 30, label: '30 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'Never' },
];

// ── Ingestion Payloads & Responses ───────────────────────────────────────────
export const DoiIngestionPayloadSchema = z.object({
  source: z.literal('doi'),
  doi: z.string().min(1, 'DOI is required'),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const CreatorOverrideSchema = z.object({
  creatorType: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  name: z.string().optional(),
  fieldMode: z.number().optional(),
});

export const IngestionOverridesSchema = z
  .object({
    title: z.string().optional(),
    abstract: z.string().optional(),
    doi: z.string().optional(),
    year: z.number().int().optional(),
    publicationTitle: z.string().optional(),
    itemType: z.string().optional(),
    creators: z.array(CreatorOverrideSchema).optional(),
    tags: z.array(z.string()).optional(),
    attachOaPdf: z.boolean().optional(),
    saveSnapshot: z.boolean().optional(),
  })
  .passthrough();

export const UrlIngestionPayloadSchema = z.object({
  source: z.literal('url'),
  url: z.string().url('A valid URL is required'),
  previewToken: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: IngestionOverridesSchema.optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const BibtexIngestionPayloadSchema = z.object({
  source: z.literal('bibtex'),
  content: z.string().optional(),
  bibtex: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: IngestionOverridesSchema.optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const PdfIngestionPayloadSchema = z.object({
  source: z.literal('pdf'),
  fileId: z.string().min(1, 'fileId is required'),
  filename: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const ArxivIngestionPayloadSchema = z.object({
  source: z.literal('arxiv'),
  arxivId: z.string().min(1, 'arXiv ID is required'),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const PmidIngestionPayloadSchema = z.object({
  source: z.literal('pmid'),
  pmid: z.string().min(1, 'PMID is required'),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const IsbnIngestionPayloadSchema = z.object({
  source: z.literal('isbn'),
  isbn: z.string().min(1, 'ISBN is required'),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const RisIngestionPayloadSchema = z.object({
  source: z.literal('ris'),
  content: z.string().optional(),
  ris: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: IngestionOverridesSchema.optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const CslJsonIngestionPayloadSchema = z.object({
  source: z.literal('csl_json'),
  content: z.string().optional(),
  cslJson: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: IngestionOverridesSchema.optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const EndnoteXmlIngestionPayloadSchema = z.object({
  source: z.literal('endnote_xml'),
  content: z.string().optional(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const ModsIngestionPayloadSchema = z.object({
  source: z.literal('mods'),
  content: z.string().optional(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const ZoteroRdfIngestionPayloadSchema = z.object({
  source: z.literal('zotero_rdf'),
  content: z.string().optional(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const MedlineIngestionPayloadSchema = z.object({
  source: z.literal('medline'),
  content: z.string().optional(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const CsvIngestionPayloadSchema = z.object({
  source: z.literal('csv'),
  content: z.string().optional(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const ZoteroIngestionPayloadSchema = z.object({
  source: z.literal('zotero'),
  connectionId: z.string().min(1),
  externalItemKey: z.string().min(1),
  payload: z.unknown(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const UnifiedIngestionPayloadSchema = z.discriminatedUnion('source', [
  DoiIngestionPayloadSchema,
  ArxivIngestionPayloadSchema,
  PmidIngestionPayloadSchema,
  IsbnIngestionPayloadSchema,
  UrlIngestionPayloadSchema,
  BibtexIngestionPayloadSchema,
  RisIngestionPayloadSchema,
  CslJsonIngestionPayloadSchema,
  EndnoteXmlIngestionPayloadSchema,
  ModsIngestionPayloadSchema,
  ZoteroRdfIngestionPayloadSchema,
  MedlineIngestionPayloadSchema,
  CsvIngestionPayloadSchema,
  PdfIngestionPayloadSchema,
  ZoteroIngestionPayloadSchema,
]);

export type UnifiedIngestionPayload = z.infer<
  typeof UnifiedIngestionPayloadSchema
>;

export const UnifiedIngestionDataSchema = z.object({
  runId: z.string(),
  status: z.enum(['completed', 'processing', 'failed']).or(z.string()),
  itemId: z.string().nullable().optional(),
  attachmentIds: z.array(z.string()).optional().default([]),
  deduplicated: z.boolean().optional().default(false),
  item: z.unknown().optional(),
  errorCategory: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const UnifiedIngestionResponseSchema = z.object({
  success: z.boolean().default(true),
  data: UnifiedIngestionDataSchema,
});

export type UnifiedIngestionResponse = z.infer<
  typeof UnifiedIngestionResponseSchema
>;

export const IngestionRunSnapshotDataSchema = z
  .object({
    id: z.string().nullable().optional(),
    runId: z.string().nullable().optional(),
    scopeId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
    sourceType: z.string().nullable().optional().default('unknown'),
    status: z.string(),
    totalItems: z.number().nullable().optional().default(1),
    processedItems: z.number().nullable().optional().default(0),
    failedItems: z.number().nullable().optional().default(0),
    itemId: z.string().nullable().optional(),
    startedAt: z.string().nullable().optional().default(() => new Date().toISOString()),
    completedAt: z.string().nullable().optional(),
    item: z.unknown().nullable().optional(),
    snapshot: z.unknown().nullable().optional(),
    title: z.string().nullable().optional(),
    itemName: z.string().nullable().optional(),
    lastError: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    executionLog: z.unknown().nullable().optional(),
  })
  .passthrough();

export const IngestionRunSnapshotResponseSchema = z.object({
  success: z.boolean().default(true),
  data: IngestionRunSnapshotDataSchema,
});

export type IngestionRunSnapshotResponse = z.infer<
  typeof IngestionRunSnapshotResponseSchema
>;

export const UrlCapturePreviewDataSchema = z.object({
  title: z.string().optional().default(''),
  url: z.string(),
  previewToken: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UrlCapturePreviewResponseSchema = z.object({
  success: z.boolean().default(true),
  data: UrlCapturePreviewDataSchema,
});

export type UrlCapturePreviewResponse = z.infer<
  typeof UrlCapturePreviewResponseSchema
>;

// ── Search & Facets ──────────────────────────────────────────────────────────
export const searchSortBySchema = z.enum([
  'relevance',
  'dateAdded',
  'createdAt',
  'updatedAt',
  'year',
  'title',
  'authors',
  'publicationTitle',
  'citationKey',
  'deletedAt',
]);

export const searchSortOrderSchema = z.enum(['asc', 'desc']);

export const searchFacetsSchema = z.object({
  itemTypes: z.record(z.string(), z.number()).optional().default({}),
  collections: z.record(z.string(), z.number()).optional().default({}),
  years: z.record(z.string(), z.number()).optional().default({}),
  tags: z.record(z.string(), z.number()).optional().default({}),
});

export const searchResponseSchema = z.object({
  items: z.array(itemSchema).default([]),
  total: z.number().optional().default(0),
  facets: searchFacetsSchema.optional(),
  meta: z
    .object({
      cursor: z.string().optional(),
      hasNextPage: z.boolean().default(false),
      pageCount: z.number().optional(),
      totalCount: z.number().optional(),
    })
    .transform((m) => {
      if (!m) return m;
      return {
        ...m,
        totalCount: m.totalCount ?? m.pageCount ?? 0,
      };
    })
    .optional(),
  nextCursor: z.string().nullable().optional(),
});

export type SearchSortBy = z.infer<typeof searchSortBySchema>;
export type SearchSortOrder = z.infer<typeof searchSortOrderSchema>;
export type SearchFacets = z.infer<typeof searchFacetsSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// ── Display Options ──────────────────────────────────────────────────────────
export type LibraryColumnKey =
  | 'authors'
  | 'year'
  | 'publication'
  | 'itemType'
  | 'doi'
  | 'citationKey'
  | 'citations';

export type LibraryOrderBy =
  | 'relevance'
  | 'createdAt'
  | 'updatedAt'
  | 'year'
  | 'title'
  | 'citationKey'
  | 'authors'
  | 'publicationTitle'
  | 'deletedAt';

const ASCENDING_DEFAULT_SORT_FIELDS = new Set<string>([
  'title',
  'authors',
  'creator',
  'firstAuthor',
  'publication',
  'publicationTitle',
  'citationKey',
]);

/**
 * Returns the natural first-click sort direction for a given column/field:
 * - Textual fields (Title, Creator, Publication, Citation Key) -> 'asc' (A -> Z)
 * - Numeric, chronological, and relevance fields (Year, Date Added/Modified/Deleted, Relevance) -> 'desc' (Newest / Highest first)
 */
export function getDefaultSortDirection(field?: string | null): 'asc' | 'desc' {
  if (!field) return 'desc';
  return ASCENDING_DEFAULT_SORT_FIELDS.has(field) ? 'asc' : 'desc';
}

export interface LibraryDisplayOptions {
  columns: Record<LibraryColumnKey, boolean>;
  orderBy: LibraryOrderBy;
  orderDirection: 'asc' | 'desc';
  density?: 'comfortable' | 'compact';
  includeSubcollections?: boolean;
}

export const DEFAULT_LIBRARY_DISPLAY_OPTIONS: LibraryDisplayOptions = {
  columns: {
    authors: true,
    year: true,
    publication: true,
    itemType: false,
    doi: false,
    citationKey: true,
    citations: false,
  },
  orderBy: 'createdAt',
  orderDirection: 'desc',
  density: 'comfortable',
  includeSubcollections: true,
};

// ── Saved Searches ───────────────────────────────────────────────────────────
export const savedSearchFieldSchema = z.string();

export const savedSearchOperatorSchema = z.enum([
  'is',
  'isNot',
  'is_not',
  'contains',
  'doesNotContain',
  'does_not_contain',
  'beginsWith',
  'begins_with',
  'endsWith',
  'ends_with',
  'isGreaterThan',
  'greater_than',
  'gt',
  'isLessThan',
  'less_than',
  'lt',
  'isBetween',
  'between',
  'isInTheLast',
  'in_the_last',
  'isPresent',
  'is_present',
  'isAbsent',
  'is_absent',
  'equals',
  'not_equals',
]);

export const savedSearchScopeOptionsSchema = z.object({
  searchSubcollections: z.boolean().optional().default(true),
  showOnlyTopLevel: z.boolean().optional().default(false),
  includeParentsAndChildren: z.boolean().optional().default(true),
});

export type SavedSearchScopeOptions = z.infer<typeof savedSearchScopeOptionsSchema>;

export const savedSearchConditionSchema = z.object({
  field: savedSearchFieldSchema,
  operator: savedSearchOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
    z.record(z.string(), z.unknown()),
  ]).optional(),
});

export type SavedSearchCondition = z.infer<typeof savedSearchConditionSchema>;

export interface SavedSearchConditionGroup {
  conjunction: 'AND' | 'OR' | 'NOT';
  conditions: (SavedSearchCondition | SavedSearchConditionGroup)[];
  scopeOptions?: SavedSearchScopeOptions;
}

export const savedSearchConditionGroupSchema: z.ZodType<SavedSearchConditionGroup> = z.lazy(() =>
  z.object({
    conjunction: z.enum(['AND', 'OR', 'NOT']).default('AND'),
    conditions: z.array(
      z.union([savedSearchConditionSchema, savedSearchConditionGroupSchema]),
    ),
    scopeOptions: savedSearchScopeOptionsSchema.optional(),
  }),
);

export const savedSearchSortBySchema = z.enum([
  'dateAdded',
  'createdAt',
  'year',
  'title',
  'creator',
  'authors',
  'firstAuthor',
  'publication',
  'publicationTitle',
  'citationKey',
  'deletedAt',
  'dateDeleted',
  'updatedAt',
  'dateModified',
]);

export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  conditions: savedSearchConditionGroupSchema,
  scopeOptions: savedSearchScopeOptionsSchema.optional(),
  conjunction: z.enum(['AND', 'OR']).default('AND'),
  sortBy: savedSearchSortBySchema.optional().default('dateAdded'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  isPinned: z.boolean().optional().default(false),
  cachedCount: z.number().nullable().optional().default(0),
  lastEvaluatedAt: z.string().datetime().nullable().optional(),
  scope: z.string().optional(),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string(),
  creator: z
    .object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().nullable().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createSavedSearchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  conditions: savedSearchConditionGroupSchema,
  scopeOptions: savedSearchScopeOptionsSchema.optional(),
  conjunction: z.enum(['AND', 'OR']).optional().default('AND'),
  sortBy: savedSearchSortBySchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isPinned: z.boolean().optional(),
  targetScope: z.string().optional(),
  scope: z.string().optional(),
});

export const updateSavedSearchSchema = createSavedSearchSchema.partial();

export const savedSearchResultsResponseSchema = z.object({
  savedSearch: savedSearchSchema,
  items: z.array(itemSchema),
  meta: z.object({
    totalCount: z.number(),
    cursor: z.string().optional(),
    hasNextPage: z.boolean(),
  }),
});

export const savedSearchPreviewResponseSchema = z.object({
  count: z.number(),
  sampleItems: z.array(itemSchema),
});

export type SavedSearchField = z.infer<typeof savedSearchFieldSchema>;
export type SavedSearchOperator = z.infer<typeof savedSearchOperatorSchema>;

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type SavedSearchResultsResponse = z.infer<
  typeof savedSearchResultsResponseSchema
>;
export type SavedSearchPreviewResponse = z.infer<
  typeof savedSearchPreviewResponseSchema
>;
