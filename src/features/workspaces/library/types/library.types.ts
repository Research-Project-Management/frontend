import { z } from 'zod';
import {
  collectionSchema,
  catalogItemSchema,
  paperSchema,
  itemAttachmentSchema,
  paperAttachmentSchema,
  primaryFileSchema,
  provenanceSchema,
  userSchema,
  creatorCreditSchema,
  noteSchema,
  cslStyleSchema,
  formattedCitationSchema,
  pdfAnnotationSchema,
  relatedPaperItemSchema,
  relatedItemSchema,
  catalogItemBundleSchema,
  paperAcademicBundleSchema,
  duplicateGroupSchema,
  libraryIntegrityReportSchema,
  asyncIngestionJobSchema,
} from '../schemas/library.schema';
import type { ReferenceData } from './reference.types';

// ── Matt Pocock Branded Types ────────────────────────────────────────────────
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

/** @deprecated Use CatalogItemId */
export type PaperId = Brand<string, 'PaperId'>;
export type CatalogItemId = Brand<string, 'CatalogItemId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type NoteId = Brand<string, 'NoteId'>;
export type TagId = Brand<string, 'TagId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;

// ── Derived Schema Types ────────────────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type CreatorCredit = z.infer<typeof creatorCreditSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type ItemAttachment = z.infer<typeof itemAttachmentSchema>;
/** @deprecated Use ItemAttachment */
export type PaperAttachment = ItemAttachment;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;


export type CslStyle = z.infer<typeof cslStyleSchema>;
export type FormattedCitation = z.infer<typeof formattedCitationSchema>;
export type PdfAnnotation = z.infer<typeof pdfAnnotationSchema>;
export type RelatedItem = z.infer<typeof relatedItemSchema>;
export type CatalogItemBundle = z.infer<typeof catalogItemBundleSchema>;
export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;
export type LibraryIntegrityReport = z.infer<typeof libraryIntegrityReportSchema>;
export type AsyncIngestionJob = z.infer<typeof asyncIngestionJobSchema>;

/** @deprecated Use RelatedItem */
export type RelatedPaperItem = RelatedItem;
/** @deprecated Use CatalogItemBundle */
export type PaperAcademicBundle = CatalogItemBundle;

export type { ReferenceData };

// ── DTOs & Mutation Inputs ───────────────────────────────────────────────────

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
  parentId?: string | null;
}

export type CreateCollectionDTO = CollectionInput;

export interface UpdateCollectionDTO {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
  parentId?: string | null;
}

export interface IngestItemDTO {
  source?: 'upload' | 'storage' | 'identifier' | 'doi' | 'bibtex' | 'ris' | 'manual';
  sourceType?: 'DOI' | 'IDENTIFIER' | 'BIBTEX' | 'RIS' | 'PDF' | 'STORAGE' | 'MANUAL';
  workspaceId?: string;
  fileId?: string | null;
  storageFileId?: string | null;
  collectionId?: string | null;
  title?: string;
  filename?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  query?: string;
  bibtex?: string;
  ris?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  isbn?: string;
  url?: string;
  abstract?: string;
  itemType?: string;
  tags?: string[];
  notes?: Record<string, unknown>[];
  citationKey?: string;
  primaryFile?: {
    fileId?: string | null;
    filename: string;
    url: string;
    size?: number;
    mimeType?: string;
  };
}

/** @deprecated Use IngestItemDTO */
export type IngestPaperDTO = IngestItemDTO;

export interface ItemQueryParams {
  collectionId?: string;
  search?: string;
  smartFilter?: 'unfiled' | 'missing-doi' | 'missing-pdf' | 'with-notes';
  limit?: number;
  skip?: number;
}

/** @deprecated Use ItemQueryParams */
export type PaperQueryParams = ItemQueryParams;

export type ItemInput = Partial<CatalogItem>;
export type CreateItemDTO = Partial<CatalogItem> & { collectionId?: string | null };
export type UpdateItemDTO = Partial<CatalogItem>;

export type Result<T> = { success: true; data: T } | { success: false; error: string };

// ── Library Sub-View States & Types ─────────────────────────────────────────

// 1. Duplicates
export interface DuplicateCluster {
  id: string;
  reason: 'doi' | 'title';
  items: CatalogItem[];
}

export interface MergeStrategy {
  primaryItemId: string;
  keepFields?: Partial<Record<keyof CatalogItem, string>>;
  deleteDuplicatesAfterMerge: boolean;
}

export interface DuplicatesState {
  clusters: DuplicateCluster[];
  selectedClusterId: string | null;
  isMerging: boolean;
}

// 2. Trash
export interface TrashItem {
  item: CatalogItem;
  deletedAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface TrashState {
  items: CatalogItem[];
  selectedItemIds: string[];
  isRestoring: boolean;
  isPurging: boolean;
}

// 3. Recently Read
export interface TimeGroupedItems {
  today: CatalogItem[];
  yesterday: CatalogItem[];
  thisWeek: CatalogItem[];
  earlier: CatalogItem[];
}

/** @deprecated Use TimeGroupedItems */
export type TimeGroupedPapers = TimeGroupedItems;

export interface RecentlyReadState {
  grouped: TimeGroupedItems;
  totalCount: number;
  isLoading: boolean;
}

// 4. Unfiled
export interface UnfiledState {
  items: CatalogItem[];
  selectedItemIds: string[];
  targetCollectionId: string | null;
  isMoving: boolean;
}

// ── Domain UI Interaction Types ─────────────────────────────────────────────

export interface AddLinkData {
  url: string;
  title?: string;
  fileUrl?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  [key: string]: any;
}

export interface PaperUploadData {
  title: string;
  authors: string[];
  year: number | null;
  doi: string;
  abstract: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  journal?: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher?: string;
  place?: string;
  keywords?: string[];
  volume?: string;
  issue?: string;
  pages?: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  issn?: string;
  isbn?: string;
  url?: string;
  type?: string;
  itemType?: string;
  date?: string;
  language?: string;
  rights?: string;
  shortTitle?: string;
  citationKey?: string;
  edition?: string;
  bookTitle?: string;
  proceedingsTitle?: string;
  conferenceName?: string;
  institution?: string;
  university?: string;
  reportNumber?: string;
  reportType?: string;
  patentNumber?: string;
  assignee?: string;
  filingDate?: string;
  extraFields?: Record<string, any>;
  [key: string]: any;
}

export interface MoveToTrashTarget {
  id: string;
  title: string;
  year?: number | null;
  authors?: string[];
}

export interface CreatorEntry {
  id: string;
  name: string;
  creatorType: string;
}

export interface SearchDiscoveryParams {
  q?: string;
  itemType?: string;
  collectionId?: string;
  tagId?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'relevance' | 'dateAdded' | 'year' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

export interface SearchFacets {
  itemTypes: Record<string, number>;
  years: Record<string, number>;
  tags: Record<string, number>;
}

// ── Backward Compatibility Aliases ───────────────────────────────────────────
/** @deprecated Use CatalogItem */
export type Paper = CatalogItem;
/** @deprecated Use ItemInput */
export type PaperInput = ItemInput;
/** @deprecated Use CreateItemDTO */
export type CreatePaperDTO = CreateItemDTO;
/** @deprecated Use UpdateItemDTO */
export type UpdatePaperDTO = UpdateItemDTO;
