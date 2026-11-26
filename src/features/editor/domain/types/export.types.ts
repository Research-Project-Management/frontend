/**
 * export.types.ts
 *
 * Canonical types and Zod schemas for single-document formatted export (`POST /docs/:pageId/export`).
 */

import { z } from 'zod';

export const documentExportFormatSchema = z.enum([
  'tex',
  'pdf',
  'docx',
  'html',
  'markdown',
  'md',
]);

export const exportDocumentSchema = z.object({
  format: documentExportFormatSchema.default('tex'),
  includeChildren: z.boolean().default(true).optional(),
});

export type DocumentExportFormat = z.infer<typeof documentExportFormatSchema>;
export type ExportDocumentInput = z.infer<typeof exportDocumentSchema>;
