import { z } from 'zod';
import {
  paperSchema,
  collectionSchema,
  noteSchema,
  paperAttachmentSchema,
  pdfAnnotationSchema,
  duplicateGroupSchema,
  libraryIntegrityReportSchema,
} from './library.schema';

// ── 1. Generic Response & Error Envelopes ───────────────────────────────────

export const apiMetaSchema = z.object({
  cursor: z.string().optional(),
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  version: z.number().optional(),
  traceId: z.string().optional(),
});

export const apiErrorDetailsSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  traceId: z.string().optional(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorDetailsSchema,
});

export function createApiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: apiMetaSchema.optional(),
  });
}

export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    createApiSuccessSchema(dataSchema),
    apiErrorResponseSchema,
  ]);
}

// ── 2. Canonical Capability Schemas ─────────────────────────────────────────

// Catalog / Items
export const catalogItemResponseSchema = createApiResponseSchema(paperSchema);
export const catalogItemListDataSchema = z
  .object({
    items: z.array(paperSchema).optional(),
    papers: z.array(paperSchema).optional(),
    total: z.number().optional().default(0),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(25),
    totalPages: z.number().optional().default(1),
    pagination: apiMetaSchema.optional(),
  })
  .transform((val) => {
    const list = val.items || val.papers || [];
    return {
      items: list,
      papers: list,
      total: val.total || (val.pagination?.total ?? list.length),
      page: val.page,
      limit: val.limit,
      totalPages: val.totalPages,
      pagination: val.pagination,
    };
  });
export const catalogItemListResponseSchema = createApiResponseSchema(catalogItemListDataSchema);

// Collections
export const collectionResponseSchema = createApiResponseSchema(collectionSchema);
export const collectionListDataSchema = z
  .object({
    collections: z.array(collectionSchema).optional(),
    items: z.array(collectionSchema).optional(),
    total: z.number().optional().default(0),
  })
  .transform((val) => {
    const list = val.collections || val.items || [];
    return {
      collections: list,
      items: list,
      total: val.total || list.length,
    };
  });
export const collectionListResponseSchema = createApiResponseSchema(collectionListDataSchema);

// Attachments
export const attachmentResponseSchema = createApiResponseSchema(paperAttachmentSchema);
export const attachmentListResponseSchema = createApiResponseSchema(z.array(paperAttachmentSchema));

// Annotations
export const annotationResponseSchema = createApiResponseSchema(pdfAnnotationSchema);
export const annotationListResponseSchema = createApiResponseSchema(z.array(pdfAnnotationSchema));

// Notes
export const noteResponseSchema = createApiResponseSchema(noteSchema);
export const noteListResponseSchema = createApiResponseSchema(z.array(noteSchema));

// Citations
export const citationFormatDataSchema = z.object({
  citationHtml: z.string().optional().default(''),
  bibliographyHtml: z.string().optional().default(''),
  style: z.string().optional().default('apa'),
});
export const citationFormatResponseSchema = createApiResponseSchema(citationFormatDataSchema);

// Quality & Duplicates
export const duplicateGroupsResponseSchema = createApiResponseSchema(
  z.object({
    groups: z.array(duplicateGroupSchema),
    duplicateCount: z.number().optional().default(0),
  }),
);

export const integrityReportResponseSchema = createApiResponseSchema(libraryIntegrityReportSchema);

// Ingestion Jobs
export const ingestionJobStatusDataSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  totalItems: z.number().optional().default(0),
  processedItems: z.number().optional().default(0),
  successfulItems: z.number().optional().default(0),
  failedItems: z.number().optional().default(0),
  error: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const ingestionJobStatusResponseSchema = createApiResponseSchema(ingestionJobStatusDataSchema);

// Sync Delta
export const syncChangeSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  entityType: z.enum(['item', 'collection', 'tag', 'attachment', 'annotation', 'note']),
  entityId: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  version: z.number(),
  payload: z.unknown().optional(),
  timestamp: z.string(),
});

export const syncChangesDataSchema = z.object({
  changes: z.array(syncChangeSchema),
  latestSequence: z.number(),
  hasMore: z.boolean(),
});
export const syncChangesResponseSchema = createApiResponseSchema(syncChangesDataSchema);

// ── Types ───────────────────────────────────────────────────────────────────

export type ApiMeta = z.infer<typeof apiMetaSchema>;
export type ApiErrorDetails = z.infer<typeof apiErrorDetailsSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type IngestionJobStatusData = z.infer<typeof ingestionJobStatusDataSchema>;
export type SyncChangeRecord = z.infer<typeof syncChangeSchema>;
export type SyncChangesData = z.infer<typeof syncChangesDataSchema>;
