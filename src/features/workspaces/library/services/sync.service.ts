import { apiGet, apiPost } from '@/shared/lib/api';

// ── SyncService ───────────────────────────────────────────────────────────────
/**
 * Offline-first delta sync service.
 * Backed by GET /sync/pull, POST /sync/push, POST /sync/resync
 */
export const SyncService = {
  /**
   * Pull delta changes since a given sequence number.
   * Returns changed entities since last sync.
   */
  pull: (workspaceId: string, sinceSeq: bigint = 0n, limit = 100) =>
    apiGet<{
      items: Array<{
        entityType: string;
        entityId: string;
        action: 'create' | 'update' | 'delete';
        version: number;
        seq: string;
        data?: any;
      }>;
      latestSeq: string;
      hasMore: boolean;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/sync/pull`,
      { params: { sinceSeq: sinceSeq.toString(), limit: limit.toString() } },
    ),

  /**
   * Push local mutations to the server.
   */
  push: (
    workspaceId: string,
    mutations: Array<{
      entityType: string;
      entityId: string;
      action: 'create' | 'update' | 'delete';
      version: number;
      data?: any;
    }>,
  ) =>
    apiPost<{ applied: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/sync/push`,
      { mutations },
    ),

  /**
   * Request a full re-sync (used when local state is corrupted or too stale).
   */
  resync: (workspaceId: string) =>
    apiPost<{
      requiresFullResync: boolean;
      latestSeq: string;
      timestamp: string;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/sync/resync`,
      {},
    ),
};
