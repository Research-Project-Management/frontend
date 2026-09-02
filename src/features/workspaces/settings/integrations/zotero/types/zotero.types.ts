export interface ZoteroConnection {
  id: string;
  workspaceId: string;
  userId: string;
  provider: string;
  accountName: string | null;
  accountType: string | null;
  zoteroUserId: string | null;
  status: 'active' | 'revoked' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ZoteroBinding {
  id: string;
  connectionId: string;
  workspaceId: string;
  remoteLibraryType: 'user' | 'group';
  remoteLibraryId: string;
  lastSyncVersion: string;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncDirection: 'read_only' | 'two_way';
  createdAt: string;
  updatedAt: string;
  connection?: {
    id: string;
    accountName: string | null;
    accountType: string | null;
    status: string;
  };
}

export interface RemoteLibrary {
  id: string;
  type: 'user' | 'group';
  name: string;
  version?: number;
  numItems?: number;
}

export interface SyncRunResult {
  syncRunId: string;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSkipped?: number;
  itemsFailed?: number;
  collectionsCreated?: number;
  versionAfter: string;
}

export interface ReconcileResult {
  deletedItems: number;
  deletedCollections: number;
  versionAfter: string;
}

export interface ZoteroConflictItem {
  id: string;
  bindingId: string;
  itemId: string;
  remoteKey: string;
  remoteVersion: string;
  syncState: 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed' | 'retryable' | 'dead_letter';
  title: string;
  baseSnapshot?: Record<string, any> | null;
  rawPayload?: Record<string, any> | null;
  updatedAt: string;
}

export interface ZoteroPendingPushItem {
  id: string;
  bindingId: string;
  itemId: string;
  remoteKey: string;
  remoteVersion: string;
  syncState: 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed';
  title: string;
  updatedAt: string;
}

export interface StorageQuotaInfo {
  total: number;
  used: number;
  available: number;
  isExceeded: boolean;
  isUnavailable?: boolean;
}

export interface KillSwitchStatus {
  globalDisabled: boolean;
  workspaceDisabled: boolean;
  reason?: string;
  changedBy?: string;
  changedAt?: string;
}

export interface ResolveConflictPayload {
  resolutionStrategy: 'use_local' | 'use_remote' | 'custom_merge';
  resolvedTitle?: string;
  resolvedItemType?: string;
  resolvedDoi?: string;
  resolvedUrl?: string;
  resolvedAbstract?: string;
  resolvedYear?: number;
  resolvedTags?: string[];
}
