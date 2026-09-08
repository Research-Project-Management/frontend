import { z } from 'zod';

export const annotationRectSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number(),
  height: z.number(),
});

export const annotationTypeSchema = z.enum([
  'highlight',
  'underline',
  'strike',
  'note',
  'box',
  'area',
]);

export const readerAnnotationSchema = z.object({
  id: z.string(),
  paperId: z.string().optional(),
  attachmentId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  pageIndex: z.number().int().nonnegative().optional(),
  color: z.string().default('yellow'),
  type: annotationTypeSchema.default('highlight'),
  text: z.string().optional(),
  quoteText: z.string().optional(),
  comment: z.string().optional(),
  rects: z.array(annotationRectSchema).optional(),
  boundingRect: annotationRectSchema.optional(),
  rectCoords: z.unknown().optional(),
  version: z.number().optional(),
  authorId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const createAnnotationSchema = z.object({
  paperId: z.string(),
  attachmentId: z.string().optional(),
  pageNumber: z.number().int().positive(),
  pageIndex: z.number().int().nonnegative().optional(),
  color: z.string().default('yellow'),
  type: annotationTypeSchema.default('highlight'),
  text: z.string().optional(),
  quoteText: z.string().optional(),
  comment: z.string().optional(),
  rects: z.array(annotationRectSchema).optional(),
  boundingRect: annotationRectSchema.optional(),
  rectCoords: z.unknown().optional(),
});

export const updateAnnotationSchema = z.object({
  color: z.string().optional(),
  comment: z.string().optional(),
  text: z.string().optional(),
  quoteText: z.string().optional(),
  rects: z.array(annotationRectSchema).optional(),
  boundingRect: annotationRectSchema.optional(),
});

export const readerPanelSchema = z.enum(['ai', 'details', 'notes', 'annotations']);
export const readerNavPanelSchema = z.enum(['outline', 'figures', 'tables', 'formulas', 'thumbnails']);
export const readerFitModeSchema = z.enum(['fit-width', 'fit-page', 'auto', 'custom']);
export const readerViewModeSchema = z.enum(['single', 'continuous', 'spread']);
export const readerRotationSchema = z.enum(['0', '90', '180', '270']);

export const readerSettingsSchema = z.object({
  activePanel: readerPanelSchema.nullable().default(null),
  panelWidth: z.number().min(280).max(640).default(400),
  zoomLevel: z.number().min(0.25).max(4.0).default(1.0),
  fitMode: readerFitModeSchema.default('auto'),
  viewMode: readerViewModeSchema.default('continuous'),
  rotation: readerRotationSchema.default('0'),
  sidebarOpen: z.boolean().default(true),
});

export const selectionContextSchema = z.object({
  text: z.string(),
  pageNumber: z.number().int().positive(),
  paperId: z.string(),
  paperTitle: z.string().optional(),
});

export const creatorTypeSchema = z.enum([
  'author',
  'editor',
  'translator',
  'contributor',
  'advisor',
  'reviewer',
  'seriesEditor',
  'bookAuthor',
]).or(z.string());

export const documentCreatorSchema = z.object({
  id: z.string().optional(),
  orderIndex: z.number().optional(),
  creatorType: creatorTypeSchema.optional(),
  name: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().optional(),
});

export const documentAttachmentSchema = z.object({
  id: z.string(),
  itemId: z.string().optional(),
  attachmentType: z.string().optional(),
  isPrimary: z.boolean().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  fileId: z.string().optional(),
  url: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const primaryFileSchema = z.object({
  fileId: z.string().optional(),
  url: z.string().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
});

export const readerNoteSchema = z.object({
  id: z.string(),
  workspaceId: z.string().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().optional(),
  contentJson: z.unknown().optional(),
  contentMd: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createNoteSchema = z.object({
  workspaceId: z.string().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().default('Untitled Note'),
  contentJson: z.unknown().optional(),
  contentMd: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

export const updateNoteSchema = z.object({
  title: z.string().optional(),
  contentJson: z.unknown().optional(),
  contentMd: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const readerCollectionSchema = z.object({
  id: z.string(),
  workspaceId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const documentReadingStateSchema = z.object({
  readStatus: z.enum(['unread', 'reading', 'completed']).default('unread'),
  rating: z.number().min(0).max(5).default(0),
  lastReadAt: z.string().nullable().optional(),
});

export const documentTagSchema = z.union([
  z.object({ id: z.string(), name: z.string(), color: z.string().optional() }),
  z.string(),
]);

export const readerDocumentSchema = z.object({
  id: z.string(),
  workspaceId: z.string().optional(),
  collectionId: z.string().nullable().optional(),
  title: z.string(),
  itemType: z.string().optional(),
  abstract: z.string().nullable().optional(),
  authors: z.array(z.string()).optional(),
  creators: z.array(documentCreatorSchema).optional(),
  year: z.number().nullable().optional(),
  doi: z.string().nullable().optional(),
  journal: z.string().nullable().optional(),
  publicationTitle: z.string().nullable().optional(),
  publicationDate: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  issue: z.string().nullable().optional(),
  pages: z.string().nullable().optional(),
  citationCount: z.number().optional(),
  citationKey: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  filename: z.string().nullable().optional(),
  ragDocId: z.string().nullable().optional(),
  ragStatus: z.enum(['pending', 'indexing', 'indexed', 'failed']).or(z.string()).optional(),
  readingState: documentReadingStateSchema.optional(),
  attachments: z.array(documentAttachmentSchema).optional(),
  primaryFile: primaryFileSchema.nullable().optional(),
  notes: z.array(readerNoteSchema).optional(),
  tags: z.array(documentTagSchema).optional(),
  version: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().optional(),
  abstract: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  doi: z.string().nullable().optional(),
  journal: z.string().nullable().optional(),
  publicationTitle: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  issue: z.string().nullable().optional(),
  pages: z.string().nullable().optional(),
  collectionId: z.string().nullable().optional(),
});

export const readerAiCitationSchema = z.object({
  pageNumber: z.number().int().positive(),
  section: z.string().optional(),
  quote: z.string().optional(),
  box: z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }).optional(),
});

export const readerAiMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const readerAiMessageSchema = z.object({
  id: z.string(),
  role: readerAiMessageRoleSchema,
  content: z.string(),
  citations: z.array(readerAiCitationSchema).optional(),
  timestamp: z.string(),
  isStreaming: z.boolean().optional(),
});

export const readerQuickPromptSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string(),
  prompt: z.string(),
  description: z.string(),
});

export const readerPaperContextSchema = z.object({
  paperId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().nullable().optional(),
  doi: z.string().optional(),
  ragDocId: z.string().optional(),
  workspaceId: z.string(),
});

// ── Form Schemas for React Hook Form ──────────────────────────────────────────

export const documentRenameFormSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(500, 'Title is too long'),
});

export const noteFormSchema = z.object({
  contentMd: z.string().trim().min(1, 'Note content cannot be empty'),
  title: z.string().trim().optional(),
  tags: z.array(z.string()).optional(),
});

export const annotationFormSchema = z.object({
  quoteText: z.string().trim().optional(),
  comment: z.string().trim().optional(),
  color: z.string().optional(),
});

export const chatMessageFormSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty'),
});

export const pageNavFormSchema = z.object({
  page: z.number().int().min(1),
});

// ── Document Fulltext Structured Schemas ─────────────────────────────────────

export const documentBoundingBoxSchema = z.object({
  page: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const documentSectionSchema = z.object({
  id: z.string(),
  num: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()),
  page: z.number(),
  coords: documentBoundingBoxSchema.optional(),
  imradCategory: z.enum(['introduction', 'methods', 'results', 'discussion', 'conclusion', 'other']).default('other'),
});

export const documentFigureSchema = z.object({
  id: z.string(),
  label: z.string(),
  caption: z.string(),
  page: z.number(),
  coords: documentBoundingBoxSchema.optional(),
});

export const documentTableSchema = z.object({
  id: z.string(),
  label: z.string(),
  caption: z.string(),
  page: z.number(),
  coords: documentBoundingBoxSchema.optional(),
  headers: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
  markdown: z.string().optional(),
});

export const documentFormulaSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  text: z.string(),
  page: z.number(),
  coords: documentBoundingBoxSchema.optional(),
});

export const documentFulltextSchema = z.object({
  title: z.string().optional(),
  abstract: z.string().optional(),
  sections: z.array(documentSectionSchema).default([]),
  figures: z.array(documentFigureSchema).default([]),
  tables: z.array(documentTableSchema).default([]),
  formulas: z.array(documentFormulaSchema).default([]),
  sectionCount: z.number().optional(),
  figureCount: z.number().optional(),
  tableCount: z.number().optional(),
  formulaCount: z.number().optional(),
});

