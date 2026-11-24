export type IntegrationProvider = 'zotero' | 'mendeley' | 'orcid' | 'github';
export type ConnectionStatus = 'connected' | 'expired' | 'revoked' | 'error';
export type IntegrationCategory = 'reference' | 'identity' | 'git';

export interface IntegrationStatusItem {
  provider: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: ConnectionStatus;
  accountName?: string | null;
  accountEmail?: string | null;
  lastSyncedAt?: string | null;
  connectedAt?: string | null;
  needsReconnect: boolean;
}

export interface RemoteCollection {
  id: string;
  name: string;
  itemCount: number;
  parentCollectionId?: string | null;
}

export interface SyncCollectionPayload {
  pageId: string;
  collectionId: string;
  collectionName?: string;
  targetBibFile?: string;
}

export interface SyncCollectionResult {
  linkId: string;
  collectionId: string;
  collectionName: string;
  targetBibFile: string;
  syncedAt: string;
  bibtexLength: number;
}

export interface GitHubPageLink {
  id: string;
  repoFullName: string;
  branch: string;
  lastSyncedAt?: string | null;
}

export interface GitHubPageStatus {
  isConnected: boolean;
  accountName?: string | null;
  link: GitHubPageLink | null;
}

export interface PushPageGithubPayload {
  pageId: string;
  commitMessage?: string;
  branch?: string;
}

export interface PushPageGithubResult {
  success: boolean;
  repoFullName: string;
  branch: string;
  commitSha: string;
  commitUrl: string;
  fileCount: number;
  syncedAt: string;
}

export interface PullPageGithubPayload {
  pageId: string;
  branch?: string;
}

export interface PullPageGithubResult {
  success: boolean;
  repoFullName: string;
  branch: string;
  filesImported: number;
  syncedAt: string;
}
