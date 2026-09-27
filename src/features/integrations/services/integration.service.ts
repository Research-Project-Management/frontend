import { apiDelete, apiGet, apiPost } from '@/shared/lib/api';
import {
  GitHubProjectStatus,
  IntegrationProvider,
  IntegrationStatusItem,
  PullProjectGithubPayload,
  PullProjectGithubResult,
  PushProjectGithubPayload,
  PushProjectGithubResult,
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

  /**
   * Gets GitHub link status and details for a project.
   */
  async getProjectGithubLink(projectId: string): Promise<GitHubProjectStatus> {
    return apiGet<GitHubProjectStatus>(`/api/v1/integrations/github/projects/${projectId}`);
  },

  /**
   * Links a project to a GitHub repository.
   */
  async linkProjectGithub(data: {
    projectId: string;
    repoFullName: string;
    branch?: string;
  }): Promise<{ linkId: string; projectId: string; repoFullName: string; branch: string }> {
    return apiPost('/api/v1/integrations/github/projects/link', data);
  },

  /**
   * Pushes project files as a commit to GitHub repository.
   */
  async pushProjectGithub(payload: PushProjectGithubPayload): Promise<PushProjectGithubResult> {
    return apiPost<PushProjectGithubResult>('/api/v1/integrations/github/projects/push', payload);
  },

  /**
   * Pulls files from GitHub repository into the project.
   */
  async pullProjectGithub(payload: PullProjectGithubPayload): Promise<PullProjectGithubResult> {
    return apiPost<PullProjectGithubResult>('/api/v1/integrations/github/projects/pull', payload);
  },
};
