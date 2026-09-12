import { z } from 'zod';
import { attachmentSchema } from './attachment.schema';
import { noteSchema } from './note.schema';

export const userSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  avatar: z.string().optional().default(''),
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

export const contributorRelationSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  creatorType: z.string().optional().default('author'),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().optional().default(''),
  name: z.string().optional(),
  orderIndex: z.number().optional().default(0),
  createdAt: z.string().optional(),
});

export const identifierSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  type: z.string(),
  value: z.string(),
  canonicalUri: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const primaryFileSchema = z.object({
  fileId: z.string().nullable().optional(),
  filename: z.string().optional().default(''),
  url: z.string().optional().default(''),
  size: z.number().optional().default(0),
  mimeType: z.string().optional().default(''),
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
  ]).or(z.string()),
  resolvedAt: z.string().optional(),
  canonicalId: z.string().optional(),
  canonicalUrl: z.string().optional(),
  confidenceScore: z.number().optional().default(1.0),
  rawSnapshotHash: z.string().optional(),
  isOpenAccess: z.boolean().optional().default(false),
  openAccessPdfUrl: z.string().nullable().optional(),
});

export const collectionRelationSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const itemTagRelationSchema = z.object({
  tag: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional(),
    type: z.string().optional(),
  }).optional(),
  tagId: z.string().optional(),
  itemId: z.string().optional(),
  addedAt: z.string().optional(),
});

export const itemSchema = z.object({
  id: z.string().optional().default(''),
  title: z.string().optional().default('Untitled Item'),
  authors: z.array(z.string()).optional().default([]),
  year: z.union([z.number(), z.string()]).nullish(),
  doi: z.string().optional().default(''),
  DOI: z.string().optional(),
  abstract: z.string().optional().default(''),
  abstractNote: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  itemType: z.string().optional().default('journalArticle'),
  type: z.string().optional(),
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
  ISSN: z.string().optional(),
  isbn: z.string().optional().default(''),
  ISBN: z.string().optional(),
  arxivId: z.string().optional(),
  archiveID: z.string().optional(),
  archiveId: z.string().optional(),
  pmid: z.string().optional(),
  PMID: z.string().optional(),
  pmcid: z.string().optional(),
  PMCID: z.string().optional(),
  url: z.string().optional().default(''),
  language: z.string().optional().default(''),
  journalAbbr: z.string().optional().default(''),
  journalAbbreviation: z.string().optional().default(''),
  shortTitle: z.string().optional().default(''),
  rights: z.string().optional().default(''),
  license: z.string().optional(),
  citationKey: z.string().optional().default(''),
  citationCount: z.union([z.number(), z.string()]).nullish(),
  referenceCount: z.union([z.number(), z.string()]).nullish(),
  openAccessPdfUrl: z.string().nullish(),
  isRetracted: z.boolean().optional().default(false),
  retractionNature: z.string().nullish(),
  retractionDetails: z.record(z.string(), z.unknown()).nullish(),
  retractionCheckedAt: z.string().nullish(),
  isMyPublication: z.boolean().optional().default(false),
  publicationConfirmedAt: z.string().nullish(),
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
  accessDate: z.string().optional(),
  extra: z.string().optional().default(''),
  extraFields: z.record(z.string(), z.unknown()).optional().default({}),
  creators: z.array(creatorCreditSchema).optional().default([]),
  contributors: z.array(contributorRelationSchema).optional().default([]),
  itemTags: z.array(itemTagRelationSchema).optional().default([]),
  collectionIds: z.array(z.string()).optional().default([]),
  collections: z.array(collectionRelationSchema).optional().default([]),
  notes: z.array(noteSchema).optional().default([]),
  notesList: z.array(noteSchema).optional().default([]),
  fileId: z.string().nullish(),
  primaryFile: primaryFileSchema.nullish(),
  attachments: z.array(attachmentSchema).optional().default([]),
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
  identifiers: z.array(identifierSchema).optional().default([]),
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

// ── Mutation & Response Schemas ─────────────────────────────────────────────
export const createItemSchema = itemSchema.partial().extend({
  title: z.string().min(1, 'Title is required'),
});

export const updateItemSchema = itemSchema.partial().extend({
  expectedVersion: z.number().optional(),
});

export const typeConversionPreviewSchema = z.object({
  targetItemType: z.string(),
});

export const typeConversionSchema = z.object({
  targetItemType: z.string(),
  expectedVersion: z.number().optional(),
  customFieldOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const bulkDeleteItemsSchema = z.object({
  itemIds: z.array(z.string()),
});

export const bulkMoveItemsSchema = z.object({
  itemIds: z.array(z.string()),
  targetCollectionId: z.string().nullable().optional(),
});

export const bulkTagItemsSchema = z.object({
  itemIds: z.array(z.string()),
  tagIds: z.array(z.string()),
});

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().optional().default(50),
});

export const cursorPaginationMetaSchema = z.object({
  totalCount: z.number().optional(),
  pageSize: z.number().optional(),
  hasMore: z.boolean().optional(),
  hasNextPage: z.boolean().optional(),
  nextCursor: z.string().nullable().optional(),
  prevCursor: z.string().nullable().optional(),
  cursor: z.string().nullable().optional(),
});

export const paginatedItemsResponseSchema = z.object({
  items: z.array(itemSchema),
  papers: z.array(itemSchema).optional(),
  pagination: cursorPaginationMetaSchema.optional(),
  meta: cursorPaginationMetaSchema.optional(),
  total: z.number().optional(),
});
