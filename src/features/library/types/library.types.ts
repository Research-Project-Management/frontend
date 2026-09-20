/**
 * Master Library Types Registry (Frontend)
 *
 * Domain-Driven Modular architecture re-exporting canonical types
 * aligned 100% with Backend Prisma models and NestJS DTOs.
 */
import { z } from 'zod';
import { Item } from './items.types';

// ── Matt Pocock Branded Types ────────────────────────────────────────────────
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type ItemId = Brand<string, 'ItemId'>;
/** @deprecated Use ItemId */
export type PaperId = ItemId;
export type CollectionId = Brand<string, 'CollectionId'>;
export type NoteId = Brand<string, 'NoteId'>;
export type ScopeId = Brand<string, 'ScopeId'>;
export type UserId = Brand<string, 'UserId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
/** @deprecated Project uses User - Project dual-scope instead of workspaces */
export type WorkspaceId = Brand<string, 'WorkspaceId'>;

// ── Domain Type Re-Exports ───────────────────────────────────────────────────
export * from './core.types';
export * from './items.types';
export * from './collections.types';
export * from './tags.types';
export * from './attachments.types';
export * from './notes.types';
export * from './state.types';
export * from './citation.types';
export * from './curation.types';
export * from './search.types';
export * from './saved-searches.types';
export * from './retraction.types';
export * from './ingestion.types';
export * from './exports.types';
export * from './item-types.types';
export * from './relations.types';
export * from './forms.types';

// ── Ingestion Job Schema & Type ──────────────────────────────────────────────
export const asyncIngestionJobSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  total: z.number().default(0),
  processed: z.number().default(0),
  successCount: z.number().default(0),
  failedCount: z.number().default(0),
  progressPercentage: z.number().default(0),
  successful: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      citationKey: z.string().optional(),
      sourceType: z.string().optional(),
      doi: z.string().optional(),
      year: z.number().nullable().optional(),
      authors: z.array(z.string()).default([]),
      ragStatus: z.string().optional(),
    }),
  ).default([]),
  failed: z.array(
    z.object({
      item: z.record(z.string(), z.unknown()),
      error: z.string(),
    }),
  ).default([]),
  createdAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type AsyncIngestionJob = z.infer<typeof asyncIngestionJobSchema>;

// ── Utility Generic Result ──────────────────────────────────────────────────
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Library Sub-View States ─────────────────────────────────────────────────
export interface TrashItem {
  item: Item;
  deletedAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface TrashState {
  items: Item[];
  selectedItemIds: string[];
  isRestoring: boolean;
  isPurging: boolean;
}

export interface TimeGroupedItems {
  today: Item[];
  yesterday: Item[];
  thisWeek: Item[];
  earlier: Item[];
}

export interface RecentlyReadState {
  grouped: TimeGroupedItems;
  totalCount: number;
  isLoading: boolean;
}

export interface UnfiledState {
  items: Item[];
  selectedItemIds: string[];
  targetCollectionId: string | null;
  isMoving: boolean;
}
