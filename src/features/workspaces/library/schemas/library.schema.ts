import { z } from 'zod';

export const userSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  avatar: z.string().optional().default(''),
});

export const collectionSchema = z.object({
  _id: z.string().optional().default(''),
  id: z.string().optional(),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional().default('📁'),
  workspaceId: z.string().optional().default(''),
  parent: z.string().nullable().optional(),
  createdBy: userSchema.optional(),
  paperCount: z.number().optional().default(0),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const noteSchema = z.object({
  _id: z.string().optional().default(''),
  id: z.string().optional(),
  content: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const paperAttachmentSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  fileId: z.string().nullable().optional(),
  filename: z.string().optional().default(''),
  url: z.string().optional().default(''),
  size: z.number().optional().default(0),
  mimeType: z.string().optional().default(''),
  attachmentType: z.enum(['primary_pdf', 'supplementary', 'dataset', 'slides', 'code', 'figure', 'other']).optional(),
  uploadedAt: z.string().optional(),
});

export const primaryFileSchema = z.object({
  fileId: z.string().nullable().optional(),
  filename: z.string().optional(),
  url: z.string().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

export const paperSchema = z.object({
  _id: z.string().optional().default(''),
  id: z.string().optional(),
  title: z.string().optional().default('Untitled Paper'),
  authors: z.array(z.string()).optional().default([]),
  year: z.union([z.number(), z.string()]).nullish(),
  doi: z.string().optional().default(''),
  abstract: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  itemType: z.string().optional().default('journalArticle'),
  editors: z.array(z.string()).optional().default([]),
  journal: z.string().optional().default(''),
  publicationTitle: z.string().optional(),
  publicationDate: z.string().optional(),
  publisher: z.string().optional().default(''),
  place: z.string().optional(),
  volume: z.string().optional().default(''),
  issue: z.string().optional().default(''),
  section: z.string().optional(),
  partNumber: z.string().optional(),
  partTitle: z.string().optional(),
  pages: z.string().optional().default(''),
  series: z.string().optional(),
  seriesTitle: z.string().optional(),
  seriesText: z.string().optional(),
  issn: z.string().optional().default(''),
  isbn: z.string().optional().default(''),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  url: z.string().optional().default(''),
  type: z.string().optional(),
  language: z.string().optional().default(''),
  journalAbbr: z.string().optional().default(''),
  shortTitle: z.string().optional().default(''),
  rights: z.string().optional().default(''),
  license: z.string().optional(),
  citationKey: z.string().optional().default(''),
  libraryCatalog: z.string().optional(),
  archive: z.string().optional(),
  archiveLocation: z.string().optional(),
  callNumber: z.string().optional(),
  accessedAt: z.string().nullish(),
  extra: z.string().optional().default(''),
  notes: z.array(noteSchema).optional().default([]),
  primaryFile: primaryFileSchema.nullish(),
  attachments: z.array(paperAttachmentSchema).optional().default([]),
  fileUrl: z.string().optional().default(''),
  filename: z.string().optional().default(''),
  mimeType: z.string().optional().default(''),
  size: z.number().optional().default(0),
  labels: z.array(z.string()).optional().default([]),
  ragDocId: z.string().nullish(),
  ragStatus: z.enum(['pending', 'indexed', 'failed']).nullish(),
  ragIndexedAt: z.string().nullish(),
  workspaceId: z.string().optional().default(''),
  collectionId: z.string().nullish(),
  uploadedBy: userSchema.optional(),
  deletedAt: z.string().nullish(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
  isFavorite: z.boolean().optional().default(false),
  readStatus: z.enum(['unread', 'reading', 'completed']).optional().default('unread'),
});

export const projectPaperRefSchema = z.object({
  paper: paperSchema.nullable(),
  addedBy: z.string(),
  note: z.string(),
  addedAt: z.string(),
});

export const projectCollectionSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  createdBy: userSchema,
  sourceCollection: z.object({
    _id: z.string(),
    name: z.string(),
    color: z.string(),
    icon: z.string(),
  }).nullable(),
  papers: z.array(projectPaperRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ── Form Schemas ─────────────────────────────────────────────────────────────

export const paperFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.string(),
  year: z.string(),
  doi: z.string(),
  journal: z.string(),
  publisher: z.string(),
  keywords: z.string(),
  abstract: z.string(),
  volume: z.string(),
  issue: z.string(),
  pages: z.string(),
  issn: z.string(),
  isbn: z.string(),
  url: z.string(),
  type: z.string(),
  language: z.string(),
  journalAbbr: z.string(),
  shortTitle: z.string(),
  rights: z.string(),
  extra: z.string(),
});

export type PaperFormValues = z.infer<typeof paperFormSchema>;

export const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  color: z.string(),
  parent: z.string().nullable().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;
