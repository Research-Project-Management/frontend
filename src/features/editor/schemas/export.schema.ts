/**
 * export.schema.ts
 *
 * Zod validation schemas for Document Export options and format selections.
 * Matches backend document/export module DTOs.
 */

import { z } from 'zod';

export const documentExportFormatSchema = z.enum([
  'pdf',
  'markdown',
  'latex-source',
  'latex-bundle',
]);

export const exportDocumentSchema = z.object({
  format: documentExportFormatSchema.default('pdf'),
  includeChildren: z.boolean().default(true).optional(),
});

export type ExportDocumentInput = z.infer<typeof exportDocumentSchema>;
