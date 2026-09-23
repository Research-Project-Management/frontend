'use client';

import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../query-keys';
import { SyncService, type SyncQueryParams } from '../services/sync.service';

export function useSyncVersionQuery(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: libraryKeys.syncVersion(scopeId),
    queryFn: () => SyncService.getVersion(scopeId),
    enabled: options?.enabled ?? true,
    staleTime: 10_000,
  });
}

export function useSyncChangesQuery(
  scopeId?: string,
  params?: SyncQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: libraryKeys.syncChanges(scopeId, params),
    queryFn: () => SyncService.getChanges(scopeId, params),
    enabled: options?.enabled ?? true,
  });
}

export function useSyncTombstonesQuery(
  scopeId?: string,
  params?: SyncQueryParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: libraryKeys.syncTombstones(scopeId, params),
    queryFn: () => SyncService.getTombstones(scopeId, params),
    enabled: options?.enabled ?? true,
  });
}
