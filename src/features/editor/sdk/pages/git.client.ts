/**
 * git.client.ts
 *
 * Git Smart-HTTP & Git Access Token sub-API for Pages.
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';

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
    return apiGet<GitRepoInfo>(`${PAGES_API_BASE}/spaces/${projectId}/git`);
  },

  listTokens: async (): Promise<{ tokens: GitTokenInfo[] }> => {
    return apiGet<{ tokens: GitTokenInfo[] }>(`${PAGES_API_BASE}/git/tokens`);
  },

  createToken: async (label?: string): Promise<{ token: string }> => {
    return apiPost<{ token: string }>(`${PAGES_API_BASE}/git/tokens`, { label });
  },

  revokeToken: async (tokenId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(`${PAGES_API_BASE}/git/tokens/${tokenId}`);
  },
};
