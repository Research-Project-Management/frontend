import { z } from 'zod';
import {
  syncEntityTypeSchema,
  syncActionSchema,
  syncMutationSchema,
  pushMutationsSchema,
  syncBatchOpTypeSchema,
  externalSyncOperationSchema,
  applyExternalSyncBatchSchema,
  syncDeltaResponseSchema,
  syncPushResponseSchema,
  syncResyncResponseSchema,
} from '../schemas/sync.schema';

export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;
export type SyncAction = z.infer<typeof syncActionSchema>;
export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type PushMutationsInput = z.infer<typeof pushMutationsSchema>;
export type SyncBatchOpType = z.infer<typeof syncBatchOpTypeSchema>;
export type ExternalSyncOperation = z.infer<typeof externalSyncOperationSchema>;
export type ApplyExternalSyncBatchInput = z.infer<
  typeof applyExternalSyncBatchSchema
>;
export type SyncDeltaResponse = z.infer<typeof syncDeltaResponseSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
export type SyncResyncResponse = z.infer<typeof syncResyncResponseSchema>;
