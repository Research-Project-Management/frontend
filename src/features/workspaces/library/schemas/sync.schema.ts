import { z } from 'zod';

export const syncEntityTypeSchema = z.enum([
  'Item',
  'Collection',
  'Attachment',
  'Note',
  'Annotation',
]);

export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;

export const syncActionSchema = z.enum(['create', 'update', 'delete']);

export type SyncAction = z.infer<typeof syncActionSchema>;

export const syncMutationSchema = z.object({
  entityType: syncEntityTypeSchema,
  entityId: z.string().min(1),
  action: syncActionSchema,
  version: z.number().int().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const pushMutationsSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(100),
});

export type PushMutationsInput = z.infer<typeof pushMutationsSchema>;

export const syncBatchOpTypeSchema = z.enum([
  'upsertCollection',
  'upsertItem',
  'upsertAttachment',
  'upsertNote',
  'upsertAnnotation',
  'deleteEntity',
]);

export type SyncBatchOpType = z.infer<typeof syncBatchOpTypeSchema>;

export const externalSyncOperationSchema = z.object({
  op: syncBatchOpTypeSchema,
  operationId: z.string().optional(),
  parentRef: z.string().optional(),
  command: z.record(z.string(), z.unknown()),
});

export type ExternalSyncOperation = z.infer<typeof externalSyncOperationSchema>;

export const applyExternalSyncBatchSchema = z.object({
  idempotencyKey: z.string().optional(),
  operations: z.array(externalSyncOperationSchema).min(1).max(100),
});

export type ApplyExternalSyncBatchInput = z.infer<typeof applyExternalSyncBatchSchema>;

export const syncDeltaResponseSchema = z.object({
  mutations: z.array(syncMutationSchema).default([]),
  latestSeq: z.string(),
  hasMore: z.boolean().default(false),
});

export type SyncDeltaResponse = z.infer<typeof syncDeltaResponseSchema>;

export const syncPushResponseSchema = z.object({
  applied: z.number(),
});

export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncResyncResponseSchema = z.object({
  requiresFullResync: z.boolean(),
  latestSeq: z.string(),
  timestamp: z.string(),
});

export type SyncResyncResponse = z.infer<typeof syncResyncResponseSchema>;
