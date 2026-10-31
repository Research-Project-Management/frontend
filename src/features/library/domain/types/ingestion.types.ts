import { z } from 'zod';

// ── Batch Upload & Progress ──────────────────────────────────────────────────
export interface IngestionProgressItem {
  id: string;
  title: string;
  status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'PROCESSING' | 'UPLOADING' | 'PENDING';
  itemId?: string;
  error?: string;
  itemName?: string;
}

export type ProcessItem = IngestionProgressItem;

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

export const DEFAULT_ACADEMIC_FEEDS: SavedFeedSubscription[] = [
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv: Artificial Intelligence (cs.AI)',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    retentionDays: 30,
    cleanupReadAfter: 7,
    cleanupUnreadAfter: 30,
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv: Computation and Language (cs.CL)',
    url: 'https://rss.arxiv.org/rss/cs.CL',
    retentionDays: 30,
    cleanupReadAfter: 7,
    cleanupUnreadAfter: 30,
  },
  {
    id: 'nature-main',
    name: 'Nature — Current Issue Research',
    url: 'https://www.nature.com/nature.rss',
    retentionDays: 30,
    cleanupReadAfter: 7,
    cleanupUnreadAfter: 30,
  },
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

export type UnifiedIngestionData = z.infer<typeof UnifiedIngestionDataSchema>;

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

export type IngestionRunSnapshotData = z.infer<typeof IngestionRunSnapshotDataSchema>;

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

export type UrlCapturePreviewData = z.infer<typeof UrlCapturePreviewDataSchema>;

export const UrlCapturePreviewResponseSchema = z.object({
  success: z.boolean().default(true),
  data: UrlCapturePreviewDataSchema,
});

export type UrlCapturePreviewResponse = z.infer<
  typeof UrlCapturePreviewResponseSchema
>;

export type DoiIngestionPayload = z.infer<typeof DoiIngestionPayloadSchema>;
export type UrlIngestionPayload = z.infer<typeof UrlIngestionPayloadSchema>;
export type BibtexIngestionPayload = z.infer<typeof BibtexIngestionPayloadSchema>;
export type PdfIngestionPayload = z.infer<typeof PdfIngestionPayloadSchema>;
export type ArxivIngestionPayload = z.infer<typeof ArxivIngestionPayloadSchema>;
export type PmidIngestionPayload = z.infer<typeof PmidIngestionPayloadSchema>;
export type IsbnIngestionPayload = z.infer<typeof IsbnIngestionPayloadSchema>;
export type RisIngestionPayload = z.infer<typeof RisIngestionPayloadSchema>;
export type ZoteroIngestionPayload = z.infer<typeof ZoteroIngestionPayloadSchema>;
