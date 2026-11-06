import { z } from 'zod';
import { userSchema, itemSchema, type Provenance } from './items.types';
import { feedRetentionDaysSchema } from './ingestion.types';

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
export * from './ingestion.types';
export * from './item-types.types';
export type {
  ReaderDocument,
  ReaderAnnotation,
  AnnotationFormData,
  TypeConversionPreview,
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  ViewportParams,
  PdfTextMatch,
  PdfSearchCycleResult,
  PdfOutlineNode,
  FlattenedOutlineSection,
  PdfOutlineProxyDoc,
} from './reader.types';
export {
  annotationFormSchema,
} from './reader.types';

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

export type TreeNode = Collection & { children: TreeNode[] };
export type CollectionHierarchyNode = TreeNode;
export type CollectionNode = TreeNode;

export interface ItemTypesResponse {
  success: boolean;
  registryVersion: number;
  schemaVersion: number;
  source: string;
  itemTypes: import('./item-types.types').SchemaItemTypeDefinition[];
  data: import('./item-types.types').SchemaItemTypeDefinition[];
  baseFieldMappings?: Record<string, Record<string, string>>;
  reverseBaseFieldMappings?: Record<string, Record<string, string>>;
  creatorRoles?: Record<string, string>;
  cslTypeMap?: Record<string, string>;
  cslFieldMap?: Record<string, string>;
}

export interface ReaderBootstrapResponse {
  scope: 'user' | 'project';
  scopeId: string;
  degraded?: boolean;
  degradedBranches?: string[];
  item: import('./items.types').Item;
  activeAttachmentId: string | null;
  annotations: import('./reader.types').ReaderAnnotation[];
  fulltext: import('./reader.types').DocumentFulltext | null;
  readingState: import('./items.types').ItemStateData | null;
  relations: import('./items.types').RelatedItem[];
  notes: import('./items.types').Note[];
  role?: ProjectRole;
  permissions?: Partial<LibraryPermissions> | string[];
}

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
export const duplicateMatchTypeSchema = z.enum([
  'DOI',
  'ARXIV',
  'PMID',
  'ISBN',
  'INGESTION_SUSPECT',
  'TITLE_AUTHOR_YEAR',
  'TITLE_AUTHOR',
]);

export const duplicateGroupSchema = z.object({
  matchType: duplicateMatchTypeSchema,
  matchReason: z.string().optional(),
  confidence: z.enum(['high', 'medium']),
  key: z.string(),
  recommendedMasterId: z.string().optional(),
  items: z.array(itemSchema),
});

export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;

// ── Forms ────────────────────────────────────────────────────────────────────
export const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

const isValidSingleIdentifierToken = (token: string): boolean => {
  const trimmed = token.trim().replace(/^[([\s<"']+/, '').replace(/[.,;:\s"')\]>]+$/, '');
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  } catch {
    // not a standard web URL
  }

  if (/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+\b/i.test(trimmed) || /^(?:doi:\s*)?10\.\d{4,9}\//i.test(trimmed)) {
    return true;
  }

  if (/^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/i.test(trimmed)) {
    return true;
  }

  if (/^(?:pmid\s*[:#]?\s*)?\d{1,9}$/i.test(trimmed) || /\bPMC\d{5,9}\b/i.test(trimmed)) {
    return true;
  }

  const cleanDigits = trimmed.replace(/^isbn(?:-?1[03])?\s*[:#]?\s*/i, '').replace(/[-\s]/g, '');
  if (/^(?:97[89]\d{10}|\d{9}[\dXx])$/.test(cleanDigits)) {
    return true;
  }

  if (/^(?:bibcode:\s*)?\d{4}[A-Za-z0-9.&]{5}[A-Za-z0-9.]{4}[A-Za-z0-9.][A-Za-z0-9.]{4}[A-Za-z]$/i.test(trimmed)) {
    return true;
  }

  return false;
};

const isValidIdentifierOrUrl = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/^@[a-zA-Z]+\s*\{/.test(trimmed) || /^TY\s+-\s+/m.test(trimmed)) {
    return true;
  }
  if (isValidSingleIdentifierToken(trimmed)) {
    return true;
  }
  const tokens = trimmed.split(/[\r\n,;]+|\s+/).filter(Boolean);
  return tokens.some(isValidSingleIdentifierToken);
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
  attachOaPdf: z.boolean().optional(),
  saveSnapshot: z.boolean().optional(),
});

export type AddLinkFormValues = z.infer<typeof addLinkSchema>;

export const myPublicationFormSchema = z.object({
  contributorId: z.string(),
  isPublic: z.boolean(),
  includeAttachments: z.boolean(),
  openAccessLicense: z.string(),
});

export type MyPublicationFormValues = z.infer<typeof myPublicationFormSchema>;

export const zoteroApiKeyConnectSchema = z.object({
  zoteroUserId: z.string().trim().min(1, 'Zotero User ID is required'),
  apiKey: z.string().trim().min(1, 'Personal API Key is required'),
});

export type ZoteroApiKeyConnectFormValues = z.infer<
  typeof zoteroApiKeyConnectSchema
>;

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

// ── Level-5 Form Resilience: Server Error Extraction & Field Mapping ─────────

export function extractServerErrorMessage(
  err: unknown,
  fallback = 'An unexpected error occurred. Please check your input and try again.',
): string {
  if (!err) return fallback;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (typeof err === 'object') {
    const candidate = err as {
      message?: unknown;
      response?: { data?: { message?: unknown; error?: unknown } };
      data?: { message?: unknown; error?: unknown };
    };
    const rawMsg =
      candidate.response?.data?.message ??
      candidate.data?.message ??
      candidate.message ??
      candidate.response?.data?.error ??
      candidate.data?.error;
    if (Array.isArray(rawMsg) && rawMsg.length > 0) {
      const first = rawMsg.find((m) => typeof m === 'string' && m.trim());
      if (typeof first === 'string') return first.trim();
    }
    if (typeof rawMsg === 'string' && rawMsg.trim()) {
      return rawMsg.trim();
    }
  }
  return fallback;
}

export function applyServerErrorToForm<TFieldName extends string>(
  err: unknown,
  setError: (
    name: TFieldName,
    error: { type: string; message: string },
    options?: { shouldFocus: boolean },
  ) => void,
  options: {
    allowedFields: readonly TFieldName[];
    fallbackField: TFieldName;
    fallbackMessage?: string;
  },
): string {
  const { allowedFields, fallbackField, fallbackMessage } = options;
  const allowedSet = new Set<string>(allowedFields);
  let focused = false;

  if (err && typeof err === 'object') {
    const payload = (
      (err as { response?: { data?: Record<string, unknown> }; data?: Record<string, unknown> })
        .response?.data ??
      (err as { data?: Record<string, unknown> }).data ??
      err
    ) as Record<string, unknown>;

    const fieldErrors = payload.errors ?? payload.fieldErrors;
    if (Array.isArray(fieldErrors)) {
      for (const item of fieldErrors) {
        if (item && typeof item === 'object') {
          const prop = String(
            (item as { field?: unknown; property?: unknown }).field ??
              (item as { property?: unknown }).property ??
              '',
          );
          const msg = String(
            (item as { message?: unknown }).message ??
              Object.values(
                ((item as { constraints?: Record<string, string> }).constraints || {}),
              )[0] ??
              '',
          ).trim();
          if (allowedSet.has(prop) && msg) {
            setError(
              prop as TFieldName,
              { type: 'server', message: msg },
              { shouldFocus: !focused },
            );
            focused = true;
          }
        }
      }
      if (focused) {
        return extractServerErrorMessage(err, fallbackMessage);
      }
    } else if (fieldErrors && typeof fieldErrors === 'object') {
      for (const [key, val] of Object.entries(fieldErrors as Record<string, unknown>)) {
        if (!allowedSet.has(key)) continue;
        const msg = Array.isArray(val)
          ? String(val[0] ?? '').trim()
          : typeof val === 'string'
            ? val.trim()
            : '';
        if (msg) {
          setError(
            key as TFieldName,
            { type: 'server', message: msg },
            { shouldFocus: !focused },
          );
          focused = true;
        }
      }
      if (focused) {
        return extractServerErrorMessage(err, fallbackMessage);
      }
    }
  }

  const message = extractServerErrorMessage(err, fallbackMessage);
  const lowerMsg = message.toLowerCase();

  let targetField: TFieldName = fallbackField;
  for (const field of allowedFields) {
    if (lowerMsg.includes(field.toLowerCase())) {
      targetField = field;
      break;
    }
  }

  setError(
    targetField,
    { type: 'server', message },
    { shouldFocus: true },
  );
  return message;
}
