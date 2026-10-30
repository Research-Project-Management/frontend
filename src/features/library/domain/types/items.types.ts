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
  orderIndex: z.number().optional().default(0),
  creatorType: z.string().optional().default('author'),
  fieldMode: z.number().optional().default(0),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().optional().default(''),
  name: z.string().optional(),
  shortName: z.string().nullable().optional(),
});

export const contributorRelationSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  creatorType: z.string().optional().default('author'),
  fieldMode: z.number().optional().default(0),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().optional().default(''),
  name: z.string().optional(),
  shortName: z.string().nullable().optional(),
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

export const itemMetaSchema = z.object({
  creatorSummary: z.string().optional(),
  parsedDate: z.string().optional(),
  numChildren: z.number().optional(),
  numTags: z.number().optional(),
});

export const itemSchema = z.object({
  id: z.string().optional().default(''),
  title: z.string().optional().default('Untitled Item'),
  itemType: z.string().optional().default('journalArticle'),
  authors: z.array(z.string()).optional().default([]),
  editors: z.array(z.string()).optional().default([]),
  creators: z.array(creatorCreditSchema).optional().default([]),
  contributors: z.array(contributorRelationSchema).optional().default([]),
  year: z.coerce.number().int().nullish(),
  date: z.string().optional(),
  publicationDate: z.string().optional(),
  publicationTitle: z.string().optional().default(''),
  journalAbbreviation: z.string().optional().default(''),
  publisher: z.string().optional().default(''),
  place: z.string().optional(),
  volume: z.string().optional().default(''),
  issue: z.string().optional().default(''),
  pages: z.string().optional().default(''),
  numberOfPages: z.union([z.string(), z.number()]).nullish(),
  numberOfVolumes: z.union([z.string(), z.number()]).nullish(),
  edition: z.union([z.string(), z.number()]).nullish(),
  series: z.string().optional(),
  seriesTitle: z.string().optional(),
  seriesText: z.string().optional(),
  seriesNumber: z.string().optional(),
  section: z.string().optional(),
  partNumber: z.string().optional(),
  partTitle: z.string().optional(),
  isbn: z.string().optional().default(''),
  issn: z.string().optional().default(''),
  doi: z.string().optional().default(''),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  arxivId: z.string().optional(),
  url: z.string().optional().default(''),
  accessDate: z.string().optional(),
  abstractNote: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  language: z.string().optional().default(''),
  shortTitle: z.string().optional().default(''),
  license: z.string().optional().default(''),
  callNumber: z.string().optional(),
  CallNumber: z.string().optional(),
  archive: z.string().optional(),
  archiveLocation: z.string().optional(),
  libraryCatalog: z.string().optional(),
  citationKey: z.string().optional().default(''),
  citationCount: z.union([z.number(), z.string()]).nullish(),
  referenceCount: z.union([z.number(), z.string()]).nullish(),
  openAccessPdfUrl: z.string().nullish(),
  extra: z.string().optional().default(''),
  extraFields: z.record(z.string(), z.unknown()).optional().default({}),
  fields: z.record(z.string(), z.unknown()).optional().default({}),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  meta: itemMetaSchema.optional(),
  tags: z.array(z.string()).optional().default([]),
  itemTags: z.array(itemTagRelationSchema).optional().default([]),
  collections: z.array(collectionRelationSchema).optional().default([]),
  collectionIds: z.array(z.string()).optional().default([]),
  attachments: z.array(attachmentSchema).optional().default([]),
  notes: z.array(noteSchema).optional().default([]),
  primaryFile: primaryFileSchema.nullish(),
  fileId: z.string().nullish(),
  fileUrl: z.string().optional().default(''),
  filename: z.string().optional().default(''),
  mimeType: z.string().optional().default(''),
  size: z.number().optional().default(0),
  hasFile: z.boolean().optional().default(false),
  fileCount: z.number().optional().default(0),
  notesCount: z.number().optional().default(0),
  noteCount: z.number().optional().default(0),
  attachmentCount: z.number().optional().default(0),
  isStarred: z.boolean().optional().default(false),
  isRead: z.boolean().optional().default(false),
  readStatus: z.enum(['unread', 'reading', 'completed']).optional().default('unread'),
  readProgress: z.number().optional(),
  currentPage: z.number().optional(),
  lastReadPage: z.number().optional(),
  scrollPosition: z.unknown().optional(),
  lastReadAt: z.string().nullish(),
  lastOpenedAt: z.string().nullish(),
  rating: z.number().optional().default(0),
  isRetracted: z.boolean().optional().default(false),
  retractionStatus: z.string().optional(),
  retractionNature: z.string().nullish(),
  retractionReason: z.string().optional(),
  retractionDate: z.string().optional(),
  retractionNoticeDoi: z.string().optional(),
  noticeUrl: z.string().optional(),
  retractionDetails: z.record(z.string(), z.unknown()).nullish(),
  retractionCheckedAt: z.string().nullish(),
  qualityScore: z.number().optional(),
  qualityIssues: z.array(z.string()).optional(),
  isMyPublication: z.boolean().optional().default(false),
  isInMyPublications: z.boolean().optional(),
  inPublications: z.boolean().optional(),
  publicationConfirmedAt: z.string().nullish(),
  crossrefEnriched: z.boolean().optional().default(false),
  identifiers: z.array(identifierSchema).optional().default([]),
  firstAuthor: z.string().nullish(),
  provenance: provenanceSchema.nullish(),
  version: z.number().optional().default(1),
  uploadedBy: userSchema.optional(),
  user: userSchema.optional(),
  userId: z.string().nullish(),
  projectId: z.string().nullish(),
  scopeId: z.string().nullish(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  dateAdded: z.string().optional(),
  deletedAt: z.string().nullish(),
  isDeleted: z.boolean().optional().default(false),
  isPending: z.boolean().optional(),
  silent: z.boolean().optional(),

  // Zotero item-type specific fields (complete Schema v42 coverage)
  DOI: z.string().optional(),
  ISBN: z.string().optional(),
  ISSN: z.string().optional(),
  PMID: z.string().optional(),
  PMCID: z.string().optional(),
  archiveID: z.string().optional(),
  archiveId: z.string().optional(),
  numPages: z.union([z.string(), z.number()]).nullish(),
  rights: z.string().optional(),
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
  organization: z.string().optional(),
  repository: z.string().optional(),
  repositoryLocation: z.string().optional(),
  company: z.string().optional(),
  distributor: z.string().optional(),
  label: z.string().optional(),
  studio: z.string().optional(),
  network: z.string().optional(),
  country: z.string().optional(),
  assignee: z.string().optional(),
  issuingAuthority: z.string().optional(),
  authority: z.string().optional(),
  patentNumber: z.string().optional(),
  applicationNumber: z.string().optional(),
  priorityNumbers: z.string().optional(),
  references: z.string().optional(),
  reportNumber: z.string().optional(),
  reportType: z.string().optional(),
  thesisType: z.string().optional(),
  genre: z.string().optional(),
  type: z.string().optional(),
  medium: z.string().optional(),
  format: z.string().optional(),
  system: z.string().optional(),
  identifier: z.string().optional(),
  standardNumber: z.string().optional(),
  filingDate: z.string().optional(),
  issueDate: z.string().optional(),
  priorityDate: z.string().optional(),
  dateDecided: z.string().optional(),
  dateEnacted: z.string().optional(),
  originalDate: z.string().optional(),
  originalPlace: z.string().optional(),
  originalPublisher: z.string().optional(),
  programmingLanguage: z.string().optional(),
  legalStatus: z.string().optional(),
  status: z.string().optional(),
  versionNumber: z.string().optional(),
  number: z.string().optional(),
  caseName: z.string().optional(),
  court: z.string().optional(),
  docketNumber: z.string().optional(),
  reporter: z.string().optional(),
  reporterVolume: z.string().optional(),
  firstPage: z.string().optional(),
  history: z.string().optional(),
  nameOfAct: z.string().optional(),
  code: z.string().optional(),
  codeNumber: z.string().optional(),
  codeVolume: z.string().optional(),
  codePages: z.string().optional(),
  publicLawNumber: z.string().optional(),
  billNumber: z.string().optional(),
  legislativeBody: z.string().optional(),
  committee: z.string().optional(),
  documentNumber: z.string().optional(),
  session: z.string().optional(),
  subject: z.string().optional(),
  postType: z.string().optional(),
  presentationType: z.string().optional(),
  meetingName: z.string().optional(),
  letterType: z.string().optional(),
  manuscriptType: z.string().optional(),
  mapType: z.string().optional(),
  scale: z.string().optional(),
  artworkMedium: z.string().optional(),
  artworkSize: z.string().optional(),
  videoRecordingFormat: z.string().optional(),
  audioRecordingFormat: z.string().optional(),
  audioFileType: z.string().optional(),
  runningTime: z.string().optional(),
  episodeNumber: z.string().optional(),
  podcastType: z.string().optional(),
  interviewMedium: z.string().optional(),
  bibtex: z.string().optional(),

  // Transient / Optimistic UI attributes
  _isProcessing: z.boolean().optional(),
  _processingStatus: z.string().optional(),
  _processingProgress: z.number().optional(),
  _processingError: z.string().optional(),
}).passthrough();

// ── Mutation & Response Schemas ─────────────────────────────────────────────
export const createItemSchema = itemSchema.partial().extend({
  title: z.string().min(1, 'Title is required'),
});

export const updateItemSchema = itemSchema.partial().extend({
  expectedVersion: z.number().optional(),
  silent: z.boolean().optional(),
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
  meta: z.union([cursorPaginationMetaSchema, itemMetaSchema, z.record(z.string(), z.unknown())]).optional(),
  total: z.number().optional(),
});

export type ItemMeta = z.infer<typeof itemMetaSchema>;
export type User = z.infer<typeof userSchema>;
export type CreatorCredit = z.infer<typeof creatorCreditSchema>;
export type ContributorRelation = z.infer<typeof contributorRelationSchema>;
export type Identifier = z.infer<typeof identifierSchema>;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CollectionRelation = z.infer<typeof collectionRelationSchema>;
export type ItemTagRelation = z.infer<typeof itemTagRelationSchema>;

export type Item = z.infer<typeof itemSchema>;
export type CreateItemDTO = z.infer<typeof createItemSchema>;
export type UpdateItemDTO = z.infer<typeof updateItemSchema>;

export type CursorPaginationMeta = z.infer<typeof cursorPaginationMetaSchema>;
export type PaginatedItemsResponse = z.infer<typeof paginatedItemsResponseSchema>;

export interface ItemQueryParams {
  page?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  searchMode?: 'title_creator_year' | 'fields_tags' | 'everything' | string;
  collectionId?: string;
  includeSubcollections?: boolean;
  tag?: string;
  itemType?: string;
  year?: number;
  fromYear?: number;
  toYear?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isStarred?: boolean;
  isRead?: boolean;
  readStatus?: 'unread' | 'reading' | 'completed' | string;
  isRetracted?: boolean;
  hasPdf?: boolean;
  hasFile?: boolean;
  hasNotes?: boolean;
  unfiled?: boolean;
  smartFilter?: 'unfiled' | 'missing-doi' | 'missing-pdf' | 'with-notes';
  view?: string;
  projectId?: string;
  fields?: readonly string[] | string[];
}
