/**
 * @file quota.service.ts
 * @description Frontend service mirroring backend QuotaController.
 * Handles user and workspace storage quota inspections and consumption balances.
 */

import { apiGet } from '@/shared/lib/api';

export interface StorageUsageResult {
  usedBytes: number;
  maxBytes: number;
  percentage: number;
  totalBytes: number;
}

export interface StorageQuotaResponse {
  scope?: 'personal' | 'project';
  projectId?: string;
  projectIdentifier?: string;
  projectName?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  totalBytes: number;
  usedBytes: number;
  projectBytes?: number;
  limitBytes?: number;
  usedFormatted?: string;
  projectFormatted?: string;
  limitFormatted?: string;
  percentage: number;
  note?: string;
}

export const getStorageUsage = (scopeId?: string, projectId?: string) => {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiGet<StorageUsageResult>(`/api/files/usage${query}`);
};

export const getStorageQuota = (
  scopeOrOptions?: { projectId?: string } | string,
  projectIdParam?: string,
): Promise<StorageQuotaResponse> => {
  const projectId =
    typeof scopeOrOptions === 'object'
      ? scopeOrOptions?.projectId
      : projectIdParam || (typeof scopeOrOptions === 'string' ? scopeOrOptions : undefined);

  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiGet<StorageQuotaResponse>(`/api/files/usage${query}`);
};
