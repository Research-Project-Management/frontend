/**
 * Master Library Schema Registry (Frontend)
 * Pure composition barrel re-exporting modular schemas aligned 100% with Backend Prisma & DTOs.
 */
export * from './core.schema';
export * from './item.schema';
export * from './collection.schema';
export * from './tag.schema';
export * from './attachment.schema';
export * from './annotation.schema';
export * from './note.schema';
export * from './state.schema';
export * from './search.schema';
export * from './citation.schema';
export * from './relation.schema';
export * from './curation.schema';
export * from './forms.schema';
export * from './saved-search.schema';
export * from './retraction.schema';
export * from './ingestion.schema';
export * from './sync.schema';
export * from './export.schema';
export * from './item-type.schema';

// ── Deprecated / Backward Compatibility Legacy Schemas ──────────────────────
import { z } from 'zod';

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
