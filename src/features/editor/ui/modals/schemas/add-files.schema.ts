import { z } from 'zod';

export const newFileModalSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(128, 'File name is too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'File name cannot contain invalid characters (<>:"/\\|?*)'),
});

export type NewFileModalFormValues = z.infer<typeof newFileModalSchema>;

export const urlImportModalSchema = z.object({
  url: z.string().trim().url('Please enter a valid HTTP/HTTPS URL'),
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(128, 'File name is too long'),
});

export type UrlImportModalFormValues = z.infer<typeof urlImportModalSchema>;

export const libraryBibtexModalSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'BibTeX file name is required')
    .max(128, 'File name is too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid file name'),
});

export type LibraryBibtexModalFormValues = z.infer<typeof libraryBibtexModalSchema>;
