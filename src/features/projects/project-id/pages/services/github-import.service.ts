/**
 * github-import.service.ts
 * Frontend Client for GitHub Integration & Repository Ingestion matching Overleaf.
 */

import { apiGet, apiPost } from '@/shared/lib/api';

export interface GitHubRepoItem {
  id: string;
  name: string;
  itemCount?: number;
}

export interface GitHubIntegrationStatus {
  github?: {
    connected: boolean;
    accountName?: string;
    accountEmail?: string;
  };
  [key: string]: any;
}

export const githubImportService = {
  getStatus: async (): Promise<GitHubIntegrationStatus> => {
    try {
      return await apiGet<GitHubIntegrationStatus>('/integrations/status');
    } catch {
      return {};
    }
  },

  getAuthUrl: async (redirectUri?: string): Promise<{ authUrl: string; state: string }> => {
    return await apiGet<{ authUrl: string; state: string }>('/integrations/github/auth-url', {
      params: redirectUri ? { redirectUri } : undefined,
    });
  },

  listRepos: async (): Promise<GitHubRepoItem[]> => {
    return await apiGet<GitHubRepoItem[]>('/integrations/github/repos');
  },

  listBranches: async (repoFullName: string): Promise<string[]> => {
    return await apiGet<string[]>('/integrations/github/branches', {
      params: { repoFullName },
    });
  },

  importRepo: async (dto: {
    projectId: string;
    repoFullName: string;
    branch?: string;
  }): Promise<{
    success: boolean;
    repoFullName: string;
    branch: string;
    filesImported: number;
    rootDocId?: string;
    rootDocPath?: string;
  }> => {
    return await apiPost('/integrations/github/projects/import', dto);
  },
};
