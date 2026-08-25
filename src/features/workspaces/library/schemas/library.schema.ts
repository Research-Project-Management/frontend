import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  avatar: z.string().optional().default(''),
});

export const collectionSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional().default('📁'),
  workspaceId: z.string().optional().default(''),
  parentId: z.string().nullable().optional(),
  parent: z.string().nullable().optional(),
  createdBy: userSchema.optional(),
  paperCount: z.number().optional().default(0),
  papersCount: z.number().optional().default(0),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const noteSchema = z.object({
  id: z.string().optional().default(''),
  content: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const paperAttachmentSchema = z.object({
  id: z.string().optional().default(''),
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

export const provenanceSchema = z.object({
  originProvider: z.enum([
    'CrossRef',
    'arXiv',
    'PubMed',
    'OpenLibrary',
    'SemanticScholar',
    'Unpaywall',
    'LocalPDFExtraction',
  ]),
  resolvedAt: z.string(),
  canonicalId: z.string(),
  canonicalUrl: z.string().optional(),
  confidenceScore: z.number().optional().default(1.0),
  rawSnapshotHash: z.string().optional(),
  isOpenAccess: z.boolean().optional().default(false),
  openAccessPdfUrl: z.string().optional(),
});

export const paperSchema = z.object({
  id: z.string().optional().default(''),
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
  arxivId: z.string().optional(),
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
  ragStatus: z.enum(['none', 'pending', 'indexing', 'indexed', 'failed']).nullish(),
  ragIndexedAt: z.string().nullish(),
  ragError: z.string().optional().default(''),
  ragAttempts: z.number().optional().default(0),
  workspaceId: z.string().optional().default(''),
  collectionId: z.string().nullish(),
  uploadedBy: userSchema.optional(),
  deletedAt: z.string().nullish(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
  isFavorite: z.boolean().optional().default(false),
  readStatus: z.enum(['unread', 'reading', 'completed']).optional().default('unread'),
  provenance: provenanceSchema.nullish(),
});

// ── CSL Citation Formatter Schemas ──────────────────────────────────────────
export const cslStyleSchema = z.enum([
  'apa',
  'ieee',
  'nature',
  'harvard',
  'chicago',
  'mla',
  'vancouver',
]);

export const formattedCitationSchema = z.object({
  style: cslStyleSchema,
  inText: z.string(),
  bibliography: z.string(),
  html: z.string(),
});

// ── PDF Annotation Schemas ──────────────────────────────────────────────────
export const annotationTypeSchema = z.enum([
  'highlight',
  'underline',
  'note',
  'box',
]);

export const pdfAnnotationSchema = z.object({
  id: z.string(),
  paperId: z.string(),
  userId: z.string().optional(),
  type: annotationTypeSchema,
  color: z.string().default('#facc15'),
  pageNumber: z.number().int().min(1),
  quote: z.string().optional(),
  text: z.string().optional(),
  comment: z.string().optional(),
  rect: z
    .object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

// ── Related Paper & Knowledge Graph Schemas ─────────────────────────────────
export const relationTypeSchema = z.enum([
  'related',
  'extends',
  'rebuts',
  'uses_dataset',
  'survey_of',
]);

export const relatedPaperItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().nullable(),
  doi: z.string().optional(),
  citationKey: z.string().optional(),
  relationType: relationTypeSchema,
  symmetric: z.boolean().default(true),
  linkedAt: z.string(),
});

export const graphNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  label: z.string().optional(),
  authors: z.array(z.string()),
  year: z.number().nullable(),
  citationKey: z.string().optional(),
  collectionId: z.string().nullable().optional(),
});

export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  relationType: relationTypeSchema,
});

export const workspaceKnowledgeGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  totalNodes: z.number(),
  totalEdges: z.number(),
});

// ── Unified Academic Bundle Schema ──────────────────────────────────────────
export const paperAcademicBundleSchema = z.object({
  paper: paperSchema,
  citationApa: formattedCitationSchema,
  citationIeee: formattedCitationSchema,
  annotations: z.array(pdfAnnotationSchema),
  totalAnnotations: z.number(),
  relatedPapers: z.array(relatedPaperItemSchema),
  totalRelatedPapers: z.number(),
});

// ── Quality & Duplicate Detection Schemas ───────────────────────────────────
export const duplicateGroupSchema = z.object({
  matchType: z.enum(['DOI', 'TITLE_AUTHOR_YEAR']),
  confidence: z.enum(['high', 'medium']),
  key: z.string(),
  papers: z.array(paperSchema),
});

export const libraryIntegrityReportSchema = z.object({
  totalPapers: z.number(),
  healthyPapers: z.number(),
  healthScorePercentage: z.number(),
  missingDoiCount: z.number(),
  missingYearCount: z.number(),
  missingAuthorsCount: z.number(),
  missingPdfCount: z.number(),
  flaggedItems: z.array(
    z.object({
      paperId: z.string(),
      title: z.string(),
      issues: z.array(z.string()),
    }),
  ),
});

// ── Async Ingestion Job Schema ──────────────────────────────────────────────
export const asyncIngestionJobSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  total: z.number(),
  processed: z.number(),
  successCount: z.number(),
  failedCount: z.number(),
  progressPercentage: z.number(),
  successful: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      citationKey: z.string(),
      sourceType: z.string(),
      doi: z.string().optional(),
      year: z.number().nullable().optional(),
      authors: z.array(z.string()),
      ragStatus: z.string(),
    }),
  ),
  failed: z.array(
    z.object({
      item: z.any(),
      error: z.string(),
    }),
  ),
  createdAt: z.string(),
  completedAt: z.string().optional(),
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
