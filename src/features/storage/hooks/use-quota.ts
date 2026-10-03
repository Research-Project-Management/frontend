/**
 * @file use-quota.ts
 * @description Frontend hooks mirroring backend QuotaController.
 * Provides queries for user and workspace storage quota metrics and limits.
 */

import { useQuery } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import { getStorageUsage, type StorageUsageResult } from '../services/quota.service';
import { getStorageQuota, type StorageQuotaResponse } from '../services/quota.service';
import { DRIVE_QUERY_OPTIONS } from './use-drive';
import { formatBytes } from '@/shared/utils/format';

export interface UseStorageQuotaOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useStorageUsage(scopeId?: string, projectId?: string) {
  return useQuery<StorageUsageResult>({
    queryKey: [...storageKeys.workspaceUsage(scopeId), projectId],
    queryFn: () => getStorageUsage(scopeId, projectId),
    enabled: true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useStorageQuota(options: UseStorageQuotaOptions = {}) {
  const { projectId, enabled = true } = options;

  const query = useQuery<StorageQuotaResponse>({
    queryKey: storageKeys.quota(projectId),
    queryFn: () => getStorageQuota({ projectId }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    enabled,
  });

  const rawUsed = (query.data as any)?.usedBytes ?? (query.data as any)?.totalBytes ?? 0;
  const rawLimit = (query.data as any)?.limitBytes ?? (query.data as any)?.maxBytes ?? 5 * 1024 * 1024 * 1024;
  const calculatedPercentage =
    query.data?.percentage !== undefined && query.data?.percentage > 0
      ? query.data.percentage
      : rawLimit > 0
        ? Math.round((Number(rawUsed) / Number(rawLimit)) * 100)
        : 0;

  return {
    data: query.data,
    quota: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isProjectScope: query.data?.scope === 'project',
    ownerName: query.data?.owner?.name || null,
    usedFormatted: query.data?.usedFormatted || formatBytes(Number(rawUsed)),
    projectFormatted: query.data?.projectFormatted || '0 MB',
    limitFormatted: query.data?.limitFormatted || formatBytes(Number(rawLimit)),
    percentage: calculatedPercentage,
  };
}
