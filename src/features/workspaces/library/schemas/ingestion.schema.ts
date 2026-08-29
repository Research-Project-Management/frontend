import { z } from 'zod';

export const DoiIngestionPayloadSchema = z.object({
  source: z.literal('doi'),
  doi: z.string().min(1, 'DOI is required'),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
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
});

export const BibtexIngestionPayloadSchema = z.object({
  source: z.literal('bibtex'),
  content: z.string().optional(),
  bibtex: z.string().optional(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const PdfIngestionPayloadSchema = z.object({
  source: z.literal('pdf'),
  fileId: z.string().min(1, 'fileId is required'),
  filename: z.string().optional(),
  collectionId: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
});

export const ZoteroIngestionPayloadSchema = z.object({
  source: z.literal('zotero'),
  connectionId: z.string().min(1),
  externalItemKey: z.string().min(1),
  payload: z.unknown(),
  collectionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const UnifiedIngestionPayloadSchema = z.discriminatedUnion('source', [
  DoiIngestionPayloadSchema,
  UrlIngestionPayloadSchema,
  BibtexIngestionPayloadSchema,
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

export const IngestionRunSnapshotDataSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceType: z.string().optional().default('unknown'),
  status: z.string(),
  totalItems: z.number().optional().default(1),
  processedItems: z.number().optional().default(0),
  failedItems: z.number().optional().default(0),
  startedAt: z.string().optional().default(() => new Date().toISOString()),
  completedAt: z.string().nullable().optional(),
});

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
