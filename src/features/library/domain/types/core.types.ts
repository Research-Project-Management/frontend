import { z } from 'zod';
import { userSchema, itemSchema, retractionNatureSchema, type Provenance } from './items.types';
import { feedRetentionDaysSchema } from './ingestion.types';
import { extractPmcId, parseBatchIdentifiersInput } from '../identifiers';

// Matt Pocock Branded Types
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type ItemId = Brand<string, 'ItemId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type NoteId = Brand<string, 'NoteId'>;
export type ScopeId = Brand<string, 'ScopeId'>;
export type UserId = Brand<string, 'UserId'>;
export type ProjectId = Brand<string, 'ProjectId'>;

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Domain Type Re-Exports
export * from './items.types';
export * from './saved-searches.types';
export * from './ingestion.types';
export * from './item-types.types';
export type {
  ReaderDocument,
  ReaderAnnotation,
  ReaderNote,
  AnnotationFormData,
  TypeConversionPreview,
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
} from './reader.schema';
export {
  annotationRectSchema,
  annotationTypeSchema,
  readerAnnotationSchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  readerNoteSchema,
  readerDocumentSchema,
  documentReadingStateSchema,
  documentSectionSchema,
  documentFigureSchema,
  documentTableSchema,
  documentFormulaSchema,
  documentReferenceSchema,
  documentFulltextSchema,
  annotationFormSchema,
} from './reader.schema';

// ── Citation & CSL Schemas ───────────────────────────────────────────────────
export const cslStyleSchema = z.string().min(1);

export const cslStyleMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  titleShort: z.string().optional(),
  category: z.string(),
  fields: z.array(z.string()).optional(),
  updated: z.string().optional(),
  isCustom: z.boolean().optional(),
});

export type CslStyleMetadata = z.infer<typeof cslStyleMetadataSchema>;

export interface StyleSummary {
  id: string;
  name: string;
  shortTitle?: string;
  category?: string;
  isPrimary?: boolean;
}

export const formattedCitationSchema = z.object({
  style: cslStyleSchema.optional(),
  styleId: z.string().optional(),
  inText: z.string(),
  bibliography: z.string(),
  citation: z.string().optional(),
  html: z.string().optional(),
  bibliographyHtml: z.string().optional(),
  source: z.enum(['publisher', 'csl-engine']).optional(),
});

export type CslStyle = z.infer<typeof cslStyleSchema>;
export type FormattedCitation = z.infer<typeof formattedCitationSchema>;

export interface ReferenceData {
  extraFields?: Record<string, unknown>;
  title: string;
  authors?: string[];
  creators?: Array<{
    creatorType?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  }>;
  editors?: string[];
  doi?: string;
  arxivId?: string;
  pmid?: string;
  pmcid?: string;
  journal?: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher?: string;
  place?: string;
  issn?: string;
  isbn?: string;
  volume?: string;
  issue?: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  pages?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  year?: number | string;
  type?: string;
  itemType?: string;
  abstract?: string;
  url?: string;
  openAccessPdfUrl?: string;
  isOpenAccess?: boolean;
  citationCount?: number | string | null;
  score?: number;
  language?: string;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  libraryCatalog?: string;
  keywords?: string[];
  tags?: string[];
  fieldsOfStudy?: string[];
  provenance?: Provenance | Record<string, unknown> | null;
  extra?: string;
  [key: string]: unknown;
}

// ── Scope & RBAC ─────────────────────────────────────────────────────────────
export type ProjectRole = 'owner' | 'coordinator' | 'contributor' | 'reviewer';

export type LibraryScopeType = 'user' | 'project';

export interface LibraryPermissions {
  readonly canRead: boolean;
  readonly canCreateItem: boolean;
  readonly canEditItem: boolean;
  readonly canDeleteItem: boolean;
  readonly canPurgeItem?: boolean;
  readonly canManageCollections: boolean;
  readonly canImport: boolean;
  readonly canExport: boolean;
  readonly canAnnotate?: boolean;
}

export interface UserLibraryScope {
  type: 'user';
  id?: string;
  name?: string;
  role?: 'owner';
  permissions?: Partial<LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
}

export interface ProjectLibraryScope {
  type: 'project';
  id: string;
  projectId?: string;
  name?: string;
  role?: ProjectRole;
  permissions?: Partial<LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
}

export type LibraryScope = UserLibraryScope | ProjectLibraryScope;

// ── Collections ──────────────────────────────────────────────────────────────
export const collectionSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional().default('📁'),
  scopeId: z.string().optional().default(''),
  projectId: z.string().nullable().optional(),
  userId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  createdBy: userSchema.optional(),
  itemCount: z.number().optional().default(0),
  recursiveItemCount: z.number().optional(),
  sortOrder: z.number().int().optional(),
  orderIndex: z.number().int().optional(),
  version: z.number().optional().default(1),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export type Collection = z.input<typeof collectionSchema> & {
  id: string;
  name: string;
};

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
  expectedVersion?: number;
  version?: number;
}

export type CreateCollectionDTO = CollectionInput;
export type UpdateCollectionDTO = Partial<CollectionInput> & {
  expectedVersion?: number;
  version?: number;
};

export interface MoveToTrashTarget {
  id?: string;
  ids?: string[];
  title?: string;
  type?: 'item' | 'items' | 'collection';
  withItems?: boolean;
  scopeId?: string;
  count?: number;
  items?: Array<{ id: string; title: string }>;
}

export type TreeNode = Collection & { children: TreeNode[] };

export interface CollectionActionHandlers {
  onStartRename: (id: string, name: string) => void;
  onSubmitRename: (id: string) => void;
  onRenameValueChange: (v: string) => void;
  onDelete: (id: string) => void;
  onDeleteWithItems: (id: string) => void;
  onMove: (collectionId: string, newParentId: string | null) => void;
  onCopy: (collectionId: string, targetParentId: string | null) => void;
  onCreateSub: (parentId: string, parentName: string) => void;
  onExportBibtex?: (id: string, name: string) => void;
  onExportBundle?: (id: string, name: string) => void;
  onLinkClick?: () => void;
  onDropItems?: (
    itemIds: string[],
    targetCollectionId: string | null,
    options?: { copy?: boolean; move?: boolean },
  ) => void;
}

// ── Curation & Integrity ─────────────────────────────────────────────────────
export const duplicateGroupSchema = z.object({
  matchType: z.enum(['DOI', 'TITLE_AUTHOR_YEAR', 'TITLE_AUTHOR']),
  confidence: z.enum(['high', 'medium']),
  key: z.string(),
  recommendedMasterId: z.string().optional(),
  items: z.array(itemSchema),
});

export const mergeStrategySchema = z.object({
  primaryItemId: z.string().min(1, 'primaryItemId is required'),
  keepFields: z.record(z.string(), z.string()).optional(),
  deleteDuplicatesAfterMerge: z.boolean().default(true),
});

export const flaggedItemIssueSchema = z.object({
  itemId: z.string(),
  title: z.string().default('Untitled'),
  issues: z.array(z.string()).default([]),
});

export const libraryIntegrityReportSchema = z.object({
  totalItems: z.number().optional().default(0),
  healthyItems: z.number().optional().default(0),
  averageQualityScore: z.number().default(100),
  healthScorePercentage: z.number().default(100),
  missingDoiCount: z.number().default(0),
  missingYearCount: z.number().default(0),
  missingAuthorsCount: z.number().default(0),
  missingAbstractCount: z.number().default(0),
  missingPdfCount: z.number().default(0),
  flaggedItems: z.array(flaggedItemIssueSchema).default([]),
  healthReport: z
    .object({
      missingDoi: z.number().default(0),
      missingAbstract: z.number().default(0),
      missingYear: z.number().default(0),
    })
    .optional(),
});

export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;
export type MergeStrategy = z.infer<typeof mergeStrategySchema>;
export type FlaggedItemIssue = z.infer<typeof flaggedItemIssueSchema>;
export type LibraryIntegrityReport = z.infer<typeof libraryIntegrityReportSchema>;

// ── Forms ────────────────────────────────────────────────────────────────────
export const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

const isValidIdentifierOrUrl = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  } catch {
    // not a standard web URL
  }

  if (/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+\b/i.test(trimmed) || /^10\.\d{4,9}\//i.test(trimmed)) {
    return true;
  }

  if (/^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/i.test(trimmed)) {
    return true;
  }

  if (/^(?:pmid:\s*)?\d{1,9}$/i.test(trimmed) || Boolean(extractPmcId(trimmed))) {
    return true;
  }

  const cleanDigits = trimmed.replace(/[-\s]/g, '');
  if (/^(?:isbn:?\s*)?(97[89]\d{10}|\d{9}[\dX])$/i.test(trimmed)) {
    return true;
  }
  if ((cleanDigits.length === 10 || cleanDigits.length === 13) && /^\d+X?$/i.test(cleanDigits)) {
    return true;
  }

  if (/^(?:bibcode:\s*)?\d{4}[A-Za-z0-9.&]{5}[A-Za-z0-9.]{4}[A-Za-z0-9.][A-Za-z0-9.]{4}[A-Za-z]$/i.test(trimmed)) {
    return true;
  }

  if (parseBatchIdentifiersInput(trimmed).length > 0) {
    return true;
  }

  return false;
};

export const addLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Identifier or URL is required')
    .refine(
      isValidIdentifierOrUrl,
      'Please enter a valid DOI, arXiv ID, PMID, ISBN, or Web URL',
    ),
  title: z.string().optional(),
});

export type AddLinkFormValues = z.infer<typeof addLinkSchema>;

export const flagRetractionSchema = z.object({
  nature: retractionNatureSchema,
  reason: z.string().min(1, 'Reason is required'),
  noticeUrl: z.string().url('Valid URL required'),
  date: z.string().optional(),
});

export type FlagRetractionFormValues = z.infer<typeof flagRetractionSchema>;

export const authorshipSchema = z.object({
  confirmed: z.boolean(),
});

export type AuthorshipFormValues = z.infer<typeof authorshipSchema>;

export const addFeedSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Feed URL is required')
    .url('Please enter a valid HTTP or HTTPS feed URL'),
  name: z.string().optional(),
  retentionDays: feedRetentionDaysSchema,
  cleanupReadAfter: feedRetentionDaysSchema.optional(),
  cleanupUnreadAfter: feedRetentionDaysSchema.optional(),
});

export type AddFeedFormValues = z.infer<typeof addFeedSchema>;

export const editFeedSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Feed URL is required')
    .url('Please enter a valid HTTP or HTTPS feed URL'),
  name: z.string().trim().min(1, 'Feed title is required'),
  retentionDays: feedRetentionDaysSchema,
  cleanupReadAfter: feedRetentionDaysSchema.optional(),
  cleanupUnreadAfter: feedRetentionDaysSchema.optional(),
});

export type EditFeedFormValues = z.infer<typeof editFeedSchema>;
