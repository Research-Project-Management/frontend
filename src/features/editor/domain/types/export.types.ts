/**
 * export.types.ts
 *
 * Types and validation schemas for document compilation export bundles and output formats.
 * Matches backend document/export module.
 */

import { z } from 'zod';

export const documentExportFormatSchema = z.enum([
  'pdf',
  'docx',
  'markdown',
  'md',
  'latex-source',
  'latex-bundle',
  'zip',
  'arxiv-zip',
  'log',
  'bbl',
]);

export const exportDocumentSchema = z.object({
  format: documentExportFormatSchema.default('pdf'),
  includeChildren: z.boolean().default(true).optional(),
});

export type DocumentExportFormat = z.infer<typeof documentExportFormatSchema>;
export type ExportDocumentInput = z.infer<typeof exportDocumentSchema>;
