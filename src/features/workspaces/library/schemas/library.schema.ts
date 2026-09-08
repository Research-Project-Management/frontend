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
  itemCount: z.number().optional().default(0),
  itemsCount: z.number().optional().default(0),
  paperCount: z.number().optional().default(0),
  papersCount: z.number().optional().default(0),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const noteSchema = z.object({
  id: z.string().optional().default(''),
  workspaceId: z.string().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().optional().default('Untitled Note'),
  contentJson: z.record(z.string(), z.unknown()).optional(),
  contentMd: z.string().optional().default(''),
  content: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  version: z.number().optional().default(1),
  createdById: z.string().optional(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const noteResponseSchema = z.object({
  success: z.boolean(),
  data: noteSchema,
});

export const noteListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(noteSchema),
});

export const itemAttachmentSchema = z.object({
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
    'OpenAlex',
    'Unpaywall',
    'DataCite',
    'doi.org/DataCite',
    'LocalPDFExtraction',
    'AcademicMetadata',
  ]),
  resolvedAt: z.string(),
  canonicalId: z.string(),
  canonicalUrl: z.string().optional(),
  confidenceScore: z.number().optional().default(1.0),
  rawSnapshotHash: z.string().optional(),
  isOpenAccess: z.boolean().optional().default(false),
  openAccessPdfUrl: z.string().optional(),
});

export const creatorCreditSchema = z.object({
  id: z.string().optional(),
  orderIndex: z.number().optional().default(0),
  creatorType: z.string().optional().default('author'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional().default(''),
  name: z.string().optional(),
});

export const catalogContributorRelationSchema = z.object({
  id: z.string().optional(),
  catalogItemId: z.string().optional(),
  creatorType: z.string().optional().default('author'),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().optional().default(''),
  name: z.string().optional(),
  orderIndex: z.number().optional().default(0),
  createdAt: z.string().optional(),
});

export const collectionRelationSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const catalogItemSchema = z.object({
  id: z.string().optional().default(''),
  title: z.string().optional().default('Untitled Item'),
  authors: z.array(z.string()).optional().default([]),
  year: z.union([z.number(), z.string()]).nullish(),
  doi: z.string().optional().default(''),
  abstract: z.string().optional().default(''),
  abstractNote: z.string().optional(),
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
  seriesNumber: z.string().optional(),
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
  citationCount: z.union([z.number(), z.string()]).nullish(),
  referenceCount: z.union([z.number(), z.string()]).nullish(),
  openAccessPdfUrl: z.string().nullish(),
  date: z.string().optional(),
  edition: z.string().optional(),
  numPages: z.string().optional(),
  numberOfVolumes: z.string().optional(),
  bookTitle: z.string().optional(),
  proceedingsTitle: z.string().optional(),
  conferenceName: z.string().optional(),
  websiteTitle: z.string().optional(),
  websiteType: z.string().optional(),
  university: z.string().optional(),
  institution: z.string().optional(),
  country: z.string().optional(),
  assignee: z.string().optional(),
  issuingAuthority: z.string().optional(),
  patentNumber: z.string().optional(),
  applicationNumber: z.string().optional(),
  reportNumber: z.string().optional(),
  reportType: z.string().optional(),
  thesisType: z.string().optional(),
  genre: z.string().optional(),
  filingDate: z.string().optional(),
  legalStatus: z.string().optional(),
  versionNumber: z.string().optional(),
  libraryCatalog: z.string().optional(),
  archive: z.string().optional(),
  archiveLocation: z.string().optional(),
  callNumber: z.string().optional(),
  accessedAt: z.string().nullish(),
  extra: z.string().optional().default(''),
  extraFields: z.record(z.string(), z.unknown()).optional().default({}),
  // Structured creator/author arrays
  creators: z.array(creatorCreditSchema).optional().default([]),
  // Raw relations returned by the API (backend includes these)
  contributors: z.array(catalogContributorRelationSchema).optional().default([]),
  itemTags: z.array(z.object({
    tag: z.object({ id: z.string(), name: z.string(), color: z.string().optional() }).optional(),
    tagId: z.string().optional(),
    catalogItemId: z.string().optional(),
  })).optional().default([]),
  collectionIds: z.array(z.string()).optional().default([]),
  collections: z.array(collectionRelationSchema).optional().default([]),
  // Notes
  notes: z.array(noteSchema).optional().default([]),
  notesList: z.array(noteSchema).optional().default([]),
  // File info
  primaryFile: primaryFileSchema.nullish(),
  attachments: z.array(itemAttachmentSchema).optional().default([]),
  fileUrl: z.string().optional().default(''),
  filename: z.string().optional().default(''),
  mimeType: z.string().optional().default(''),
  size: z.number().optional().default(0),
  labels: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  crossrefEnriched: z.boolean().optional().default(false),
  ragDocId: z.string().nullish(),
  ragStatus: z.enum(['none', 'pending', 'indexing', 'indexed', 'failed']).nullish(),
  ragIndexedAt: z.string().nullish(),
  ragError: z.string().optional().default(''),
  ragAttempts: z.number().optional().default(0),
  // Raw identifiers array returned by BE (DOI, arXiv, PMID, etc.)
  identifiers: z.array(z.object({
    id: z.string().optional(),
    type: z.string(),
    value: z.string(),
    canonicalUri: z.string().optional(),
  })).optional().default([]),
  // User state fields (flattened by mapFlattenedState on BE)
  rating: z.number().optional().default(0),
  workspaceId: z.string().optional().default(''),
  collectionId: z.string().nullish(),
  uploadedBy: userSchema.optional(),
  deletedAt: z.string().nullish(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
  lastReadAt: z.string().nullish(),
  readStatus: z.enum(['unread', 'reading', 'completed']).optional().default('unread'),
  version: z.number().optional().default(1),
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
  'bibtex',
  'ris',
]);

export const formattedCitationSchema = z.object({
  style: cslStyleSchema.optional(),
  styleId: z.string().optional(),
  inText: z.string(),
  bibliography: z.string(),
  html: z.string().optional(),
  bibliographyHtml: z.string().optional(),
  source: z.enum(['publisher', 'csl-engine']).optional(),
});

// ── PDF Annotation Schemas ──────────────────────────────────────────────────
export const annotationTypeSchema = z.enum([
  'highlight',
  'underline',
  'note',
  'box',
]);

export const pdfAnnotationSchema = z.object({
  id: z.string().optional().default(''),
  attachmentId: z.string().optional(),
  paperId: z.string().optional(),
  userId: z.string().optional(),
  authorId: z.string().optional(),
  type: annotationTypeSchema.optional().default('highlight'),
  color: z.string().default('#ffeb3b'),
  pageIndex: z.number().int().optional().default(0),
  pageNumber: z.number().int().optional().default(1),
  quote: z.string().nullable().optional(),
  quoteText: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  rectCoords: z.record(z.string(), z.unknown()).optional(),
  rect: z
    .object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    })
    .optional(),
  version: z.number().optional().default(1),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

// ── Related Item Schemas ────────────────────────────────────────────────────
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
export const relatedItemSchema = relatedPaperItemSchema;

// ── Unified Academic Bundle Schema ──────────────────────────────────────────
export const catalogItemBundleSchema = z.object({
  item: catalogItemSchema.optional(),
  paper: catalogItemSchema.optional(),
  citationApa: formattedCitationSchema,
  citationIeee: formattedCitationSchema,
  annotations: z.array(pdfAnnotationSchema),
  totalAnnotations: z.number(),
  relatedPapers: z.array(relatedPaperItemSchema),
  totalRelatedPapers: z.number(),
});
/** @deprecated Use catalogItemBundleSchema */
export const paperAcademicBundleSchema = catalogItemBundleSchema;

// ── Quality & Duplicate Detection Schemas ───────────────────────────────────
export const duplicateGroupSchema = z.object({
  matchType: z.enum(['DOI', 'TITLE_AUTHOR_YEAR']),
  confidence: z.enum(['high', 'medium']),
  key: z.string(),
  papers: z.array(catalogItemSchema),
  items: z.array(catalogItemSchema).optional(),
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
      item: z.record(z.string(), z.unknown()),
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
  parentId: z.string().nullable().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

