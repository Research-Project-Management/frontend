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
  'EXTRACTING',
  'COMPLETED',
  'FAILED',
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

// Canonical Alias
export const itemAttachmentSchema = attachmentSchema;
