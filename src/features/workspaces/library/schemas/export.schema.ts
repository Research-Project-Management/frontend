import { z } from 'zod';

export const exportFormatSchema = z.enum([
  'bibtex',
  'ris',
  'csl-json',
  'csv',
  'markdown',
]);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportLibrarySchema = z.object({
  format: exportFormatSchema.default('bibtex'),
  itemIds: z.array(z.string()).optional(),
  collectionId: z.string().optional(),
  tagId: z.string().optional(),
});

export type ExportLibraryInput = z.infer<typeof exportLibrarySchema>;

export const exportByCitationKeysSchema = z.object({
  keys: z.array(z.string()).min(1, 'At least one citation key is required'),
});

export type ExportByCitationKeysInput = z.infer<typeof exportByCitationKeysSchema>;

export const exportBundleFileSchema = z.object({
  itemId: z.string().optional(),
  paperId: z.string().optional(),
  title: z.string(),
  filename: z.string(),
  fileUrl: z.string(),
});

export const exportBundleResponseSchema = z.object({
  collection: z.object({
    id: z.string(),
    name: z.string(),
  }),
  totalItems: z.number().optional(),
  totalPapers: z.number().optional(),
  totalFiles: z.number(),
  bibtex: z.string(),
  files: z.array(exportBundleFileSchema),
});

export type ExportBundleResponse = z.infer<typeof exportBundleResponseSchema>;

export const annotatedPdfResponseSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  base64: z.string(),
});

export type AnnotatedPdfResponse = z.infer<typeof annotatedPdfResponseSchema>;
