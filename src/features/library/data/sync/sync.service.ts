import { apiGet } from '@/shared/lib/api';
import { isProjectScope } from '../../domain';

export interface SyncVersionResponse {
  version: string;
  scope: 'user' | 'project';
  scopeId: string;
}

export interface SyncChangeItem {
  id: string;
  seq: string;
  userId?: string | null;
  projectId?: string | null;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | string;
  version: number;
  data?: any;
  createdAt: string;
}

export interface SyncChangesResponse {
  since: string;
  count: number;
  hasMore: boolean;
  changes: SyncChangeItem[];
}

export interface SyncTombstoneItem {
  id: string;
  seq: string;
  userId?: string | null;
  projectId?: string | null;
  entityType: string;
  entityId: string;
  deletedById?: string | null;
  deletedAt: string;
}

export interface SyncTombstonesResponse {
  since: string;
  count: number;
  hasMore: boolean;
  tombstones: SyncTombstoneItem[];
}

export interface SyncQueryParams {
  since?: string;
  limit?: number;
}

function getSyncUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/sync`
    : `/api/v1/library/sync`;
  return suffix ? `${base}/${suffix}` : base;
}

export const SyncService = {
  getVersion: (scopeId?: string) =>
    apiGet<SyncVersionResponse>(getSyncUrl(scopeId, 'version')),

  getChanges: (scopeId?: string, params?: SyncQueryParams) =>
    apiGet<SyncChangesResponse>(getSyncUrl(scopeId, 'changes'), {
      params: {
        since: params?.since ?? '0',
        limit: params?.limit ?? 100,
      },
    }),

  getTombstones: (scopeId?: string, params?: SyncQueryParams) =>
    apiGet<SyncTombstonesResponse>(getSyncUrl(scopeId, 'tombstones'), {
      params: {
        ...(params?.since !== undefined ? { since: params.since } : {}),
        limit: params?.limit ?? 100,
      },
    }),
};
