import { z } from 'zod';
import {
  exportFormatSchema,
  exportLibrarySchema,
  exportByCitationKeysSchema,
  exportBundleResponseSchema,
  annotatedPdfResponseSchema,
} from '../schemas/export.schema';

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ExportLibraryInput = z.infer<typeof exportLibrarySchema>;
export type ExportByCitationKeysInput = z.infer<typeof exportByCitationKeysSchema>;
export type ExportBundleResponse = z.infer<typeof exportBundleResponseSchema>;
export type AnnotatedPdfResponse = z.infer<typeof annotatedPdfResponseSchema>;
