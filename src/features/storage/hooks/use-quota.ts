/**
 * @file use-quota.ts
 * @description Frontend hooks mirroring backend QuotaController.
 * Provides queries for user and workspace storage quota metrics and limits.
 */

import { useQuery } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import { getStorageUsage, type StorageUsageResult } from '../services/quota.service';
import { DRIVE_QUERY_OPTIONS } from './use-drive';

export function useStorageUsage(scopeId?: string, projectId?: string) {
  return useQuery<StorageUsageResult>({
    queryKey: [...storageKeys.workspaceUsage(scopeId), projectId],
    queryFn: () => getStorageUsage(scopeId, projectId),
    enabled: true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export const useStorageQuota = useStorageUsage;
