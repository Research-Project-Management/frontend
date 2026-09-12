import { z } from 'zod';

export const paperFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.string().optional().default(''),
  year: z.string().optional().default(''),
  doi: z.string().optional().default(''),
  journal: z.string().optional().default(''),
  publisher: z.string().optional().default(''),
  keywords: z.string().optional().default(''),
  abstract: z.string().optional().default(''),
  volume: z.string().optional().default(''),
  issue: z.string().optional().default(''),
  pages: z.string().optional().default(''),
  issn: z.string().optional().default(''),
  isbn: z.string().optional().default(''),
  url: z.string().optional().default(''),
  type: z.string().optional().default('journalArticle'),
  language: z.string().optional().default(''),
  journalAbbr: z.string().optional().default(''),
  shortTitle: z.string().optional().default(''),
  rights: z.string().optional().default(''),
  extra: z.string().optional().default(''),
});

export const itemFormSchema = paperFormSchema;

export type PaperFormValues = z.infer<typeof paperFormSchema>;
export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  color: z.string(),
  parent: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export const tagFormSchema = z.object({
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional().default('#3b82f6'),
});

export type TagFormValues = z.infer<typeof tagFormSchema>;
