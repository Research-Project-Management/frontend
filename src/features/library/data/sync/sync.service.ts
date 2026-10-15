export interface SyncDiagnosticsResponse {
  status: string;
  timestamp: string;
  resilience: Record<string, unknown>;
  outbox: {
    workerId: string;
    metrics: {
      dispatches: number;
    };
  };
}

import * as api from "@/shared/lib/api";
import { isProjectScope } from '@/features/library/domain/item-url';

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
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface SyncChangesResponse {
  since: string;
  count: number;
  hasMore: boolean;
  compacted?: boolean;
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
  compact?: boolean;
}

function getSyncUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/sync`
    : `/api/v1/library/sync`;
  return suffix ? `${base}/${suffix}` : base;
}

export const SyncService = {
  getDiagnostics: (scopeId?: string) =>
    api.apiGet<SyncDiagnosticsResponse>(getSyncUrl(scopeId, 'diagnostics')),

  getVersion: (scopeId?: string) =>
    api.apiGet<SyncVersionResponse>(getSyncUrl(scopeId, 'version')),

  getChanges: (scopeId?: string, params?: SyncQueryParams) =>
    api.apiGet<SyncChangesResponse>(getSyncUrl(scopeId, 'changes'), {
      params: {
        since: params?.since ?? '0',
        limit: params?.limit ?? 100,
        ...(params?.compact !== undefined ? { compact: params.compact } : {}),
      },
    }),

  getTombstones: (scopeId?: string, params?: SyncQueryParams) =>
    api.apiGet<SyncTombstonesResponse>(getSyncUrl(scopeId, 'tombstones'), {
      params: {
        ...(params?.since !== undefined ? { since: params.since } : {}),
        limit: params?.limit ?? 100,
      },
    }),
};
