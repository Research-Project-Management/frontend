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

export const attachmentTypeSchema = z.enum([
  'primary_pdf',
  'supplementary',
  'dataset',
  'slides',
  'code',
  'figure',
  'other',
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
  filename: z.string().optional().default(''),
  url: z.string().optional().default(''),
  fileHash: z.string().nullable().optional(),
  size: z.number().optional().default(0),
  mimeType: z.string().optional().default(''),
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

export const addRevisionSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  filename: z.string().optional(),
  comment: z.string().optional(),
});

export const createAttachmentSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  filename: z.string().min(1, 'filename is required'),
  url: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  attachmentType: attachmentTypeSchema.optional(),
});

export const updateAttachmentSchema = z.object({
  filename: z.string().optional(),
  attachmentType: attachmentTypeSchema.optional(),
});

export const itemAttachmentSchema = attachmentSchema;

export type ItemAttachment = z.infer<typeof attachmentSchema>;
export type AttachmentDto = ItemAttachment;
export type AttachmentRevision = z.infer<typeof attachmentRevisionSchema>;
export type AttachmentRevisionDto = AttachmentRevision;
export type AttachmentType = z.infer<typeof attachmentTypeSchema>;
export type AttachmentExtractionStatus = z.infer<
  typeof attachmentExtractionStatusSchema
>;

export type AddRevisionInput = z.infer<typeof addRevisionSchema>;
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
