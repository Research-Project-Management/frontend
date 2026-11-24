import { apiDelete, apiGet, apiPost } from '@/shared/lib/api';
import type {
  GitHubPageStatus,
  IntegrationProvider,
  IntegrationStatusItem,
  PullPageGithubPayload,
  PullPageGithubResult,
  PushPageGithubPayload,
  PushPageGithubResult,
  RemoteCollection,
  SyncCollectionPayload,
  SyncCollectionResult,
} from '../types/integration.types';

export const integrationService = {
  /**
   * Retrieves connection statuses for all supported third-party providers.
   */
  async getStatuses(): Promise<IntegrationStatusItem[]> {
    return apiGet<IntegrationStatusItem[]>('/api/v1/integrations/status');
  },

  /**
   * Generates authorization URL for opening OAuth popup.
   */
  async getAuthUrl(provider: IntegrationProvider): Promise<{ authUrl: string; state: string }> {
    return apiGet<{ authUrl: string; state: string }>(`/api/v1/integrations/${provider}/auth-url`);
  },

  /**
   * Disconnects an active integration.
   */
  async disconnect(provider: IntegrationProvider): Promise<void> {
    await apiDelete(`/api/v1/integrations/${provider}`);
  },

  /**
   * Connects Zotero directly using Personal API Key & User ID.
   */
  async connectZoteroApiKey(payload: {
    zoteroUserId: string;
    apiKey: string;
  }): Promise<{ success: boolean; accountName: string }> {
    return apiPost<{ success: boolean; accountName: string }>(
      '/api/v1/integrations/zotero/api-key',
      payload,
    );
  },

  /**
   * Lists remote collections for a connected provider.
   */
  async getCollections(provider: IntegrationProvider): Promise<RemoteCollection[]> {
    return apiGet<RemoteCollection[]>(`/api/v1/integrations/${provider}/collections`);
  },

  /**
   * Synchronizes a remote collection into the project's references.bib file.
   */
  async syncCollection(
    provider: IntegrationProvider,
    payload: SyncCollectionPayload,
  ): Promise<SyncCollectionResult> {
    return apiPost<SyncCollectionResult>(`/api/v1/integrations/${provider}/sync`, payload);
  },

  /**
   * Fetches BibTeX content of a remote Zotero/Mendeley collection for direct Library ingestion.
   */
  async getCollectionBibtex(
    provider: IntegrationProvider,
    collectionId: string,
  ): Promise<{ provider: string; collectionId: string; bibtex: string; syncedAt: string }> {
    return apiGet<{ provider: string; collectionId: string; bibtex: string; syncedAt: string }>(
      `/api/v1/integrations/${provider}/collections/${encodeURIComponent(collectionId)}/bibtex`,
    );
  },

  // ============================================================================
  // GitHub Repository & Git Sync APIs
  // ============================================================================

  /**
   * Lists user's repositories from connected GitHub account.
   */
  async listGithubRepos(): Promise<RemoteCollection[]> {
    return apiGet<RemoteCollection[]>('/api/v1/integrations/github/repos');
  },

  /**
   * Lists branches for a specific GitHub repository.
   */
  async listGithubBranches(repoFullName: string): Promise<string[]> {
    return apiGet<string[]>(
      `/api/v1/integrations/github/branches?repoFullName=${encodeURIComponent(repoFullName)}`,
    );
  },

  /**
   * Creates a new repository on GitHub.
   */
  async createGithubRepo(data: {
    name: string;
    private?: boolean;
    description?: string;
  }): Promise<{ fullName: string; htmlUrl: string; defaultBranch: string }> {
    return apiPost('/api/v1/integrations/github/repos', data);
  },

  async getPageGithubLink(pageId: string): Promise<GitHubPageStatus> {
    return apiGet<GitHubPageStatus>(`/api/v1/integrations/github/pages/${pageId}`);
  },

  async linkPageGithub(data: {
    pageId: string;
    repoFullName: string;
    branch?: string;
  }): Promise<{ linkId: string; pageId: string; repoFullName: string; branch: string }> {
    return apiPost('/api/v1/integrations/github/pages/link', data);
  },

  async pushPageGithub(payload: PushPageGithubPayload): Promise<PushPageGithubResult> {
    return apiPost<PushPageGithubResult>('/api/v1/integrations/github/pages/push', payload);
  },

  async pullPageGithub(payload: PullPageGithubPayload): Promise<PullPageGithubResult> {
    return apiPost<PullPageGithubResult>('/api/v1/integrations/github/pages/pull', payload);
  },
};
