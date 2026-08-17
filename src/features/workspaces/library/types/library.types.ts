import { z } from 'zod';
import {
  collectionSchema,
  paperSchema,
  paperAttachmentSchema,
  primaryFileSchema,
  projectPaperRefSchema,
  projectCollectionSchema,
  userSchema,
  noteSchema,
} from '../schemas/library.schema';
import type { ReferenceData } from './reference.types';

// ── Matt Pocock Branded Types ────────────────────────────────────────────────
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type PaperId = Brand<string, 'PaperId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type NoteId = Brand<string, 'NoteId'>;
export type TagId = Brand<string, 'TagId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;

// ── Derived Schema Types ──────────────────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type PaperAttachment = z.infer<typeof paperAttachmentSchema>;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Paper = z.infer<typeof paperSchema>;
export type ProjectPaperRef = z.infer<typeof projectPaperRefSchema>;
export type ProjectCollection = z.infer<typeof projectCollectionSchema>;

export type { ReferenceData };

// ── DTOs & Mutation Inputs ────────────────────────────────────────────────────

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
}

export type CreateCollectionDTO = CollectionInput;

export interface UpdateCollectionDTO {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
}

export interface IngestPaperDTO {
  source?: 'upload' | 'storage' | 'identifier';
  fileId?: string | null;
  collectionId?: string | null;
  title?: string;
  filename?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  citationKey?: string;
}

export interface PaperQueryParams {
  collectionId?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export type PaperInput = Partial<Paper>;
export type CreatePaperDTO = Partial<Paper> & { collectionId?: string | null };
export type UpdatePaperDTO = Partial<Paper>;

export type Result<T> = { success: true; data: T } | { success: false; error: string };

// ── Library Sub-View States & Types ──────────────────────────────────────────

// 1. Duplicates
export interface DuplicateCluster {
  id: string;
  reason: 'doi' | 'title';
  papers: Paper[];
}

export interface MergeStrategy {
  primaryPaperId: string;
  keepFields?: Partial<Record<keyof Paper, string>>;
  deleteDuplicatesAfterMerge: boolean;
}

export interface DuplicatesState {
  clusters: DuplicateCluster[];
  selectedClusterId: string | null;
  isMerging: boolean;
}

// 2. Trash
export interface TrashItem {
  paper: Paper;
  deletedAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface TrashState {
  papers: Paper[];
  selectedPaperIds: string[];
  isRestoring: boolean;
  isPurging: boolean;
}

// 3. Favorites
export type FavoritesSortBy = 'year' | 'title' | 'author' | 'dateAdded';

export interface FavoritesFilterOptions {
  sortBy?: FavoritesSortBy;
  searchQuery?: string;
  tag?: string;
}

export interface FavoritesState {
  papers: Paper[];
  selectedPaperId: string | null;
  isLoading: boolean;
}

// 4. Recently Read
export interface TimeGroupedPapers {
  today: Paper[];
  yesterday: Paper[];
  thisWeek: Paper[];
  earlier: Paper[];
}

export interface RecentlyReadState {
  grouped: TimeGroupedPapers;
  totalCount: number;
  isLoading: boolean;
}

// 5. Unfiled
export interface UnfiledState {
  papers: Paper[];
  selectedPaperIds: string[];
  targetCollectionId: string | null;
  isMoving: boolean;
}
