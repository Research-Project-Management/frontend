import { z } from 'zod';

export const userSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar: z.string(),
});

export const collectionSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
  workspaceId: z.string(),
  parent: z.string().nullable(),
  createdBy: userSchema.optional(),
  paperCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const noteSchema = z.object({
  _id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paperAttachmentSchema = z.object({
  _id: z.string().optional(),
  fileId: z.string().nullable().optional(),
  filename: z.string(),
  url: z.string(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
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
  _id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().nullable(),
  doi: z.string(),
  abstract: z.string(),
  keywords: z.array(z.string()),
  itemType: z.string().optional(),
  editors: z.array(z.string()).optional(),
  journal: z.string(),
  publicationTitle: z.string().optional(),
  publicationDate: z.string().optional(),
  publisher: z.string(),
  place: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  section: z.string().optional(),
  partNumber: z.string().optional(),
  partTitle: z.string().optional(),
  pages: z.string().optional(),
  series: z.string().optional(),
  seriesTitle: z.string().optional(),
  seriesText: z.string().optional(),
  issn: z.string().optional(),
  isbn: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  language: z.string().optional(),
  journalAbbr: z.string().optional(),
  shortTitle: z.string().optional(),
  rights: z.string().optional(),
  license: z.string().optional(),
  citationKey: z.string().optional(),
  libraryCatalog: z.string().optional(),
  archive: z.string().optional(),
  archiveLocation: z.string().optional(),
  callNumber: z.string().optional(),
  accessedAt: z.string().nullable().optional(),
  extra: z.string().optional(),
  notes: z.array(noteSchema).optional(),
  primaryFile: primaryFileSchema.optional(),
  attachments: z.array(paperAttachmentSchema).optional(),
  fileUrl: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  labels: z.array(z.string()),
  ragDocId: z.string().nullable(),
  ragStatus: z.enum(['pending', 'indexed', 'failed']).nullable(),
  ragIndexedAt: z.string().nullable(),
  workspaceId: z.string(),
  collectionId: z.string().nullable(),
  uploadedBy: userSchema,
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
