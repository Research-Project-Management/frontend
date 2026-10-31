import { z } from 'zod';

export const attachmentRevisionSchema = z.object({
  id: z.string().optional().default(''),
  attachmentId: z.string().optional().default(''),
  revisionNumber: z.number().int().default(1),
  fileHash: z.string().optional().default(''),
  sizeBytes: z.number().default(0),
  url: z.string().default(''),
  comment: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
});

export const linkModeSchema = z.enum([
  'imported_file',
  'imported_url',
  'linked_url',
  'linked_file',
]);

export const attachmentTypeSchema = z.enum([
  'primary_pdf',
  'supplementary',
  'dataset',
  'slides',
  'code',
  'figure',
  'snapshot',
  'web_snapshot',
  'imported_file',
  'other',
  'preview',
]);

export const attachmentExtractionStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'FAILED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
]);

export const attachmentSchema = z.object({
  id: z.string().optional().default(''),
  itemId: z.string().optional(),
  fileId: z.string().nullable().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  filename: z.string().optional().default(''),
  url: z.string().optional().default(''),
  fileHash: z.string().nullable().optional(),
  size: z.number().optional().default(0),
  mimeType: z.string().optional().default(''),
  contentType: z.string().optional(),
  storageKey: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  linkMode: linkModeSchema.optional().default('imported_file'),
  attachmentType: attachmentTypeSchema.optional().default('supplementary'),
  uploadedAt: z.string().optional(),
  extractionStatus: attachmentExtractionStatusSchema.optional(),
  extractionAttempts: z.number().int().optional(),
  extractionStartedAt: z.string().nullable().optional(),
  extractionCompletedAt: z.string().nullable().optional(),
  extractionLastError: z.string().nullable().optional(),
  revisions: z.array(attachmentRevisionSchema).optional(),
  annotations: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type ItemAttachment = z.input<typeof attachmentSchema> & {
  id: string;
};
export type AttachmentRevision = z.infer<typeof attachmentRevisionSchema>;
export type LinkMode = z.infer<typeof linkModeSchema>;
export type AttachmentType = z.infer<typeof attachmentTypeSchema>;
export type AttachmentExtractionStatus = z.infer<
  typeof attachmentExtractionStatusSchema
>;

