import { z } from 'zod';

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
});

export const UrlIngestionPayloadSchema = z.object({
  source: z.literal('url'),
  url: z.string().url('A valid URL is required'),
  previewToken: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: z
    .object({
      title: z.string().optional(),
      abstract: z.string().optional(),
      doi: z.string().optional(),
      year: z.number().int().optional(),
      publicationTitle: z.string().optional(),
      itemType: z.string().optional(),
      creators: z.array(CreatorOverrideSchema).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  idempotencyKey: z.string().optional(),
  silent: z.boolean().optional(),
});

export const BibtexIngestionPayloadSchema = z.object({
  source: z.literal('bibtex'),
  content: z.string().optional(),
  bibtex: z.string().optional(),
  collectionId: z.string().optional(),
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
  PdfIngestionPayloadSchema,
  ZoteroIngestionPayloadSchema,
]);

export type UnifiedIngestionPayload = z.infer<
  typeof UnifiedIngestionPayloadSchema
>;

export const UnifiedIngestionDataSchema = z.object({
  runId: z.string(),
  status: z.enum(['completed', 'processing', 'failed']).or(z.string()),
  itemId: z.string().optional(),
  attachmentIds: z.array(z.string()).optional().default([]),
  deduplicated: z.boolean().optional().default(false),
  item: z.unknown().optional(),
  errorCategory: z.string().optional(),
  errorMessage: z.string().optional(),
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
    workspaceId: z.string().nullable().optional(),
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

export const bibtexPayloadSchema = BibtexIngestionPayloadSchema;
export const pdfPayloadSchema = PdfIngestionPayloadSchema;
export const zoteroPayloadSchema = ZoteroIngestionPayloadSchema;
export const ingestPayloadSchema = UnifiedIngestionPayloadSchema;
export const ingestResponseSchema = UnifiedIngestionResponseSchema;
export const runSnapshotDataSchema = IngestionRunSnapshotDataSchema;
export const runSnapshotResponseSchema = IngestionRunSnapshotResponseSchema;
export const urlPreviewResponseSchema = UrlCapturePreviewResponseSchema;

export type DoiIngestionPayload = z.infer<typeof DoiIngestionPayloadSchema>;
export type UrlIngestionPayload = z.infer<typeof UrlIngestionPayloadSchema>;
export type BibtexIngestionPayload = z.infer<typeof BibtexIngestionPayloadSchema>;
export type PdfIngestionPayload = z.infer<typeof PdfIngestionPayloadSchema>;
export type ArxivIngestionPayload = z.infer<typeof ArxivIngestionPayloadSchema>;
export type PmidIngestionPayload = z.infer<typeof PmidIngestionPayloadSchema>;
export type IsbnIngestionPayload = z.infer<typeof IsbnIngestionPayloadSchema>;
export type RisIngestionPayload = z.infer<typeof RisIngestionPayloadSchema>;
export type ZoteroIngestionPayload = z.infer<typeof ZoteroIngestionPayloadSchema>;

export interface IngestItemDTO {
  source?: 'upload' | 'storage' | 'identifier' | 'doi' | 'bibtex' | 'ris' | 'manual';
  sourceType?: 'DOI' | 'IDENTIFIER' | 'BIBTEX' | 'RIS' | 'PDF' | 'STORAGE' | 'MANUAL';
  scopeId?: string;
  projectId?: string;
  userId?: string;
  workspaceId?: string;
  fileId?: string | null;
  storageFileId?: string | null;
  collectionId?: string | null;
  title?: string;
  filename?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  query?: string;
  bibtex?: string;
  ris?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  isbn?: string;
  url?: string;
  abstract?: string;
  itemType?: string;
  tags?: string[];
  notes?: Record<string, unknown>[];
  citationKey?: string;
  primaryFile?: {
    fileId?: string | null;
    filename: string;
    url: string;
    size?: number;
    mimeType?: string;
  };
}
