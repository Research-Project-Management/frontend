/**
 * git.api.ts
 *
 * Git Smart-HTTP & Git Access Token sub-API for Manuscripts.
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';

export interface GitTokenInfo {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface GitRepoInfo {
  enabled: boolean;
  cloneUrl: string;
  branch: string;
  canPush: boolean;
  tokens: GitTokenInfo[];
}

export const gitApi = {
  getRepoInfo: async (projectId: string): Promise<GitRepoInfo> => {
    return apiGet<GitRepoInfo>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/git`);
  },

  listTokens: async (): Promise<{ tokens: GitTokenInfo[] }> => {
    return apiGet<{ tokens: GitTokenInfo[] }>(`${MANUSCRIPTS_API_BASE}/git/tokens`);
  },

  createToken: async (label?: string): Promise<{ token: string }> => {
    return apiPost<{ token: string }>(`${MANUSCRIPTS_API_BASE}/git/tokens`, { label });
  },

  revokeToken: async (tokenId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(`${MANUSCRIPTS_API_BASE}/git/tokens/${tokenId}`);
  },
};
