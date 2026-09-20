import { z } from 'zod';
import { attachmentSchema } from './attachments.types';
import { noteSchema } from './notes.types';

export const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  avatar: z.string().optional().default(''),
});

export const creatorCreditSchema = z.object({
  id: z.string().optional(),
  orderIndex: z.number(),
  creatorType: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string(),
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
  projectId: z.string().optional(),
  userId: z.string().optional(),
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
  assignedAt: z.string().optional(),
});

export const itemSchema = z.object({
  id: z.string().optional().default(''),
  title: z.string().optional().default('Untitled Item'),
  authors: z.array(z.string()).optional().default([]),
  year: z.coerce.number().int().nullish(),
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
  edition: z.union([z.string(), z.number()]).nullish(),
  numPages: z.union([z.string(), z.number()]).nullish(),
  numberOfPages: z.union([z.string(), z.number()]).nullish(),
  numberOfVolumes: z.union([z.string(), z.number()]).nullish(),
  bookTitle: z.string().optional(),
  proceedingsTitle: z.string().optional(),
  conferenceName: z.string().optional(),
  eventPlace: z.string().optional(),
  websiteTitle: z.string().optional(),
  websiteType: z.string().optional(),
  blogTitle: z.string().optional(),
  dictionaryTitle: z.string().optional(),
  encyclopediaTitle: z.string().optional(),
  forumTitle: z.string().optional(),
  sessionTitle: z.string().optional(),
  programTitle: z.string().optional(),
  university: z.string().optional(),
  institution: z.string().optional(),
  repository: z.string().optional(),
  company: z.string().optional(),
  distributor: z.string().optional(),
  label: z.string().optional(),
  studio: z.string().optional(),
  network: z.string().optional(),
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
  issueDate: z.string().optional(),
  priorityDate: z.string().optional(),
  programmingLanguage: z.string().optional(),
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
  ragStatus: z.enum(['pending', 'indexed', 'failed']).nullish(),
  ragIndexedAt: z.string().nullish(),
  ragError: z.string().optional().default(''),
  ragAttempts: z.number().optional().default(0),
  identifiers: z.array(identifierSchema).optional().default([]),
  rating: z.number().optional().default(0),
  workspaceId: z.string().optional().default(''),
  collectionId: z.string().nullish(),
  uploadedBy: userSchema.optional(),
  user: userSchema.optional(),
  userId: z.string().nullish(),
  projectId: z.string().nullish(),
  scopeId: z.string().nullish(),
  deletedAt: z.string().nullish(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
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

export type User = z.infer<typeof userSchema>;
export type CreatorCredit = z.infer<typeof creatorCreditSchema>;
export type ContributorRelation = z.infer<typeof contributorRelationSchema>;
export type Identifier = z.infer<typeof identifierSchema>;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CollectionRelation = z.infer<typeof collectionRelationSchema>;
export type ItemTagRelation = z.infer<typeof itemTagRelationSchema>;

export type Item = z.infer<typeof itemSchema>;
/** @deprecated Use Item */
export type Paper = Item;
export type ItemDto = Item;

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export type CreateItemDTO = CreateItemInput;
export type UpdateItemDTO = UpdateItemInput;
export type ItemInput = Partial<Item>;

export type TypeConversionPreviewInput = z.infer<typeof typeConversionPreviewSchema>;
export type TypeConversionInput = z.infer<typeof typeConversionSchema>;

export type BulkDeleteItemsInput = z.infer<typeof bulkDeleteItemsSchema>;
export type BulkMoveItemsInput = z.infer<typeof bulkMoveItemsSchema>;
export type BulkTagItemsInput = z.infer<typeof bulkTagItemsSchema>;

export type CursorPaginationMeta = z.infer<typeof cursorPaginationMetaSchema>;
export type PaginatedItemsResponse = z.infer<typeof paginatedItemsResponseSchema>;

export interface ItemQueryParams {
  collectionId?: string;
  search?: string;
  smartFilter?: 'unfiled' | 'missing-doi' | 'missing-pdf' | 'with-notes';
  limit?: number;
  skip?: number;
  view?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tagId?: string;
  tags?: string[];
  type?: string;
  itemType?: string;
  year?: number;
  readStatus?: 'unread' | 'reading' | 'completed';
}
