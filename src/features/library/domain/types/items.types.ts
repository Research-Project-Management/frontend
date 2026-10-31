import { z } from 'zod';

// ── Attachments ──────────────────────────────────────────────────────────────
export const attachmentRevisionSchema = z.object({
  id: z.string().optional().default(''),
  attachmentId: z.string().optional().default(''),
  revisionNumber: z.number().int().default(1),
  fileHash: z.string().optional().default(''),
  sizeBytes: z.number().default(0),
  url: z.string().default(''),
  comment: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
});

export const linkModeSchema = z.enum([
  'imported_file',
  'imported_url',
  'linked_url',
  'linked_file',
]);

export const attachmentTypeSchema = z.enum([
  'primary_pdf',
  'supplementary',
  'dataset',
  'slides',
  'code',
  'figure',
  'snapshot',
  'web_snapshot',
  'imported_file',
  'other',
  'preview',
]);

export const attachmentExtractionStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'FAILED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
]);

export const attachmentSchema = z.object({
  id: z.string().optional().default(''),
  itemId: z.string().optional(),
  fileId: z.string().nullable().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  filename: z.string().optional().default(''),
  url: z.string().optional().default(''),
  fileHash: z.string().nullable().optional(),
  size: z.number().optional().default(0),
  mimeType: z.string().optional().default(''),
  contentType: z.string().optional(),
  storageKey: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  linkMode: linkModeSchema.optional().default('imported_file'),
  attachmentType: attachmentTypeSchema.optional().default('supplementary'),
  uploadedAt: z.string().optional(),
  extractionStatus: attachmentExtractionStatusSchema.optional(),
  extractionAttempts: z.number().int().optional(),
  extractionStartedAt: z.string().nullable().optional(),
  extractionCompletedAt: z.string().nullable().optional(),
  extractionLastError: z.string().nullable().optional(),
  revisions: z.array(attachmentRevisionSchema).optional(),
  annotations: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type ItemAttachment = z.input<typeof attachmentSchema> & {
  id: string;
};
export type AttachmentRevision = z.infer<typeof attachmentRevisionSchema>;
export type LinkMode = z.infer<typeof linkModeSchema>;
export type AttachmentType = z.infer<typeof attachmentTypeSchema>;
export type AttachmentExtractionStatus = z.infer<
  typeof attachmentExtractionStatusSchema
>;

// ── Notes ────────────────────────────────────────────────────────────────────
export const noteSchema = z.object({
  id: z.string().optional().default(''),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().optional().default('Untitled Note'),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  contentMd: z.string().optional().default(''),
  content: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  version: z.number().optional().default(1),
  createdById: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const noteResponseSchema = z.object({
  success: z.boolean().default(true),
  data: noteSchema,
});

export const noteListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(noteSchema),
});

export const createNoteSchema = z.object({
  projectId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().optional().default('Untitled Note'),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  contentMd: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
});

export const updateNoteSchema = z.object({
  title: z.string().optional(),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  contentMd: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.number().int().optional(),
  expectedVersion: z.number().int().optional(),
});

export type Note = z.input<typeof noteSchema> & {
  id: string;
};
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;

// ── Tags ─────────────────────────────────────────────────────────────────────
export const tagTypeSchema = z.enum(['manual', 'automatic', 'ai']);

export const tagSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional().default('#3b82f6'),
  shortcut: z.number().int().min(1).max(9).nullable().optional(),
  type: tagTypeSchema.or(z.string()).optional().default('manual'),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  _count: z.object({
    itemTags: z.number(),
  }).optional(),
  itemCount: z.number().optional().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional().default('#3b82f6'),
  shortcut: z.number().int().min(1).max(9).nullable().optional(),
  type: tagTypeSchema.optional().default('manual'),
  projectId: z.string().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  shortcut: z.number().int().min(1).max(9).nullable().optional(),
  type: tagTypeSchema.optional(),
  projectId: z.string().optional(),
});

export const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string()),
  targetTagId: z.string(),
});

export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = Tag;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type MergeTagsInput = z.infer<typeof mergeTagsSchema>;

// ── Relations ────────────────────────────────────────────────────────────────
export const relationTypeSchema = z.enum([
  'related',
  'cites',
  'citedBy',
  'isCitedBy',
  'cited_by',
  'supplementTo',
  'supplement_to',
  'isSupplementedBy',
  'supplements',
  'partOf',
  'part_of',
  'continues',
  'isContinuedBy',
  'continued_by',
  'replicates',
  'extends',
  'is_preprint_of',
  'is_published_version_of',
  'is_translation_of',
  'rebuts',
  'uses_dataset',
  'survey_of',
]);

export const RelationTypeSchema = relationTypeSchema;

const LEGACY_RELATION_TYPE_MAP: Record<string, z.infer<typeof relationTypeSchema>> = {
  cited_by: 'isCitedBy',
  supplement_to: 'supplementTo',
  part_of: 'partOf',
  continued_by: 'isContinuedBy',
};

export function normalizeRelationType(
  raw?: unknown,
): z.infer<typeof relationTypeSchema> {
  if (typeof raw !== 'string' || !raw.trim()) return 'related';
  const trimmed = raw.trim();
  if (trimmed in LEGACY_RELATION_TYPE_MAP) {
    return LEGACY_RELATION_TYPE_MAP[trimmed];
  }
  const parsed = relationTypeSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : 'related';
}

export const relatedItemSchema = z.object({
  id: z.string(),
  relationId: z.string().optional(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  year: z.number().nullable().optional(),
  doi: z.string().optional(),
  itemType: z.string().optional(),
  citationKey: z.string().optional(),
  relationType: relationTypeSchema.default('related'),
  direction: z.enum(['outgoing', 'incoming']).optional(),
  description: z.string().optional(),
  symmetric: z.boolean().default(true),
  linkedAt: z.string().optional(),
});

export const linkRelationSchema = z.object({
  targetItemId: z.string().optional(),
  targetItemIds: z.array(z.string()).optional(),
  relationType: relationTypeSchema.optional().default('related'),
  note: z.string().optional(),
});

export type RelationType = z.infer<typeof relationTypeSchema>;
export type RelatedItem = z.infer<typeof relatedItemSchema>;
export type LinkRelationInput = z.infer<typeof linkRelationSchema>;

// ── Retraction ───────────────────────────────────────────────────────────────
export const retractionNatureSchema = z.enum([
  'retraction',
  'expression_of_concern',
  'correction',
  'manual',
]);

export const retractionDetailsSchema = z.object({
  nature: retractionNatureSchema,
  reason: z.string().optional(),
  noticeUrl: z.string().optional(),
  date: z.string().optional(),
  source: z.enum(['crossref', 'openalex', 'retraction_watch', 'manual']),
});

export const flagRetractionInputSchema = z.object({
  nature: retractionNatureSchema.optional().default('manual'),
  reason: z.string().optional(),
  noticeUrl: z.string().optional(),
  date: z.string().optional(),
});

export const retractionStatsSchema = z.object({
  totalItems: z.number(),
  checkedItems: z.number(),
  retractedCount: z.number(),
  expressionsOfConcernCount: z.number(),
  manualCount: z.number(),
});

export type RetractionNature = z.infer<typeof retractionNatureSchema>;
export type RetractionDetails = z.infer<typeof retractionDetailsSchema>;
export type FlagRetractionInput = z.infer<typeof flagRetractionInputSchema>;
export type RetractionStats = z.infer<typeof retractionStatsSchema>;

// ── Items & Creators ─────────────────────────────────────────────────────────
export const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  avatar: z.string().optional().default(''),
});

export const creatorCreditSchema = z.object({
  id: z.string().optional(),
  orderIndex: z.number().optional(),
  creatorType: z.string().optional(),
  fieldMode: z.number().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().optional(),
  name: z.string().optional(),
  shortName: z.string().nullable().optional(),
});

export const contributorRelationSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  creatorType: z.string().optional(),
  fieldMode: z.number().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  fullName: z.string().optional(),
  name: z.string().optional(),
  shortName: z.string().nullable().optional(),
  orderIndex: z.number().optional(),
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

export const baseItemSchema = z.object({
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
  readStatus: z.enum(['unread', 'reading', 'completed', 'read']).optional().default('unread'),
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
  venue: z.string().optional(),

  // Transient / Optimistic UI attributes
  _isProcessing: z.boolean().optional(),
  _processingStatus: z.string().optional(),
  _processingProgress: z.number().optional(),
  _processingError: z.string().optional(),
});

export const itemSchema = baseItemSchema.passthrough();

// ── Mutation & Response Schemas ─────────────────────────────────────────────
export const createItemSchema = baseItemSchema.partial().extend({
  title: z.string().min(1, 'Title is required'),
});

export const updateItemSchema = baseItemSchema.partial().extend({
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

export type Item = z.infer<typeof baseItemSchema>;
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

export const readStatusSchema = z.enum(['unread', 'reading', 'completed']);

export const itemStateSchema = z.object({
  isStarred: z.boolean().optional().default(false),
  readStatus: readStatusSchema.default('unread'),
  rating: z.number().min(0).max(5).default(0),
  lastOpenedAt: z.string().nullable().optional(),
  lastReadAt: z.string().nullable().optional(),
  currentPage: z.number().optional(),
  scrollPosition: z.unknown().optional(),
});

export type ReadStatus = z.infer<typeof readStatusSchema>;
export type ItemStateData = z.infer<typeof itemStateSchema>;
