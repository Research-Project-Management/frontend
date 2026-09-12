'use client';

import { useQuery } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import { getStorageQuota, type StorageQuotaResponse } from '../services/file.service';

export interface UseStorageQuotaOptions {
  projectId?: string;
  enabled?: boolean;
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

  return {
    data: query.data,
    quota: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isProjectScope: query.data?.scope === 'project',
    ownerName: query.data?.owner?.name || null,
    usedFormatted: query.data?.usedFormatted || '0 MB',
    projectFormatted: query.data?.projectFormatted || '0 MB',
    limitFormatted: query.data?.limitFormatted || '5 GB',
    percentage: query.data?.percentage ?? 0,
  };
}
