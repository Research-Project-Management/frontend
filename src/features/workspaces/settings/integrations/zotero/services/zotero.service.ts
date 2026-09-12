import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";
import type {
  ZoteroConnection,
  ZoteroBinding,
  RemoteLibrary,
  SyncRunResult,
  ReconcileResult,
  ZoteroConflictItem,
  ZoteroPendingPushItem,
  StorageQuotaInfo,
  KillSwitchStatus,
  ResolveConflictPayload,
} from '../types/zotero.types';

export const zoteroKeys = {
  all: ['zotero'] as const,
  connections: (workspaceId: string) =>
    [...zoteroKeys.all, 'connections', workspaceId] as const,
  bindings: (workspaceId: string) =>
    [...zoteroKeys.all, 'bindings', workspaceId] as const,
  libraries: (workspaceId: string, connectionId: string) =>
    [...zoteroKeys.all, 'libraries', workspaceId, connectionId] as const,
  conflicts: (workspaceId: string, bindingId?: string) =>
    [...zoteroKeys.all, 'conflicts', workspaceId, bindingId || 'all'] as const,
  pendingPushes: (workspaceId: string, bindingId?: string) =>
    [...zoteroKeys.all, 'pendingPushes', workspaceId, bindingId || 'all'] as const,
  killSwitch: (workspaceId: string) =>
    [...zoteroKeys.all, 'killSwitch', workspaceId] as const,
  storageQuota: (workspaceId: string, bindingId: string) =>
    [...zoteroKeys.all, 'storageQuota', workspaceId, bindingId] as const,
};

const getBasePath = (workspaceId: string) =>
  `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/integrations/zotero`;

export async function createZoteroConnection(
  workspaceId: string,
  data: {
    apiKey: string;
    accountName?: string;
    zoteroUserId?: string;
    accountType?: 'user' | 'group';
  },
): Promise<{ data?: ZoteroConnection; error?: { message: string } }> {
  return apiPost<{ data?: ZoteroConnection; error?: { message: string } }>(
    `${getBasePath(workspaceId)}/connections`,
    data,
  );
}

export async function listZoteroConnections(
  workspaceId: string,
): Promise<{ data: ZoteroConnection[] }> {
  return apiGet<{ data: ZoteroConnection[] }>(
    `${getBasePath(workspaceId)}/connections`,
  );
}

export async function revokeZoteroConnection(
  workspaceId: string,
  connectionId: string,
): Promise<{ data: { success: boolean } }> {
  return apiDelete<{ data: { success: boolean } }>(
    `${getBasePath(workspaceId)}/connections/${connectionId}`,
  );
}

export async function listRemoteLibraries(
  workspaceId: string,
  connectionId: string,
): Promise<{ data: RemoteLibrary[] }> {
  return apiGet<{ data: RemoteLibrary[] }>(
    `${getBasePath(workspaceId)}/connections/${connectionId}/libraries`,
  );
}

export async function createZoteroBinding(
  workspaceId: string,
  data: {
    connectionId: string;
    remoteLibraryType?: 'user' | 'group';
    remoteLibraryId: string;
    syncDirection?: 'read_only' | 'two_way';
  },
): Promise<{ data: ZoteroBinding }> {
  return apiPost<{ data: ZoteroBinding }>(
    `${getBasePath(workspaceId)}/bindings`,
    data,
  );
}

export async function listZoteroBindings(
  workspaceId: string,
  connectionId?: string,
): Promise<{ data: ZoteroBinding[] }> {
  const query = connectionId ? `?connectionId=${connectionId}` : '';
  return apiGet<{ data: ZoteroBinding[] }>(
    `${getBasePath(workspaceId)}/bindings${query}`,
  );
}

export async function updateZoteroSyncDirection(
  workspaceId: string,
  bindingId: string,
  syncDirection: 'read_only' | 'two_way',
): Promise<{ data: ZoteroBinding }> {
  return apiPatch<{ data: ZoteroBinding }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/sync-direction`,
    { syncDirection },
  );
}

export async function triggerZoteroPull(
  workspaceId: string,
  bindingId: string,
): Promise<{ data: SyncRunResult }> {
  return apiPost<{ data: SyncRunResult }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/sync-runs`,
    {},
  );
}

export async function triggerZoteroReconcile(
  workspaceId: string,
  bindingId: string,
): Promise<{ data: ReconcileResult }> {
  return apiPost<{ data: ReconcileResult }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/reconcile`,
    {},
  );
}

export async function pushZoteroItem(
  workspaceId: string,
  bindingId: string,
  itemId: string,
): Promise<{ data: any }> {
  return apiPost<{ data: any }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/push/${itemId}`,
    {},
  );
}

export async function listZoteroConflicts(
  workspaceId: string,
  bindingId?: string,
): Promise<{ data: ZoteroConflictItem[] }> {
  const url = bindingId
    ? `${getBasePath(workspaceId)}/bindings/${bindingId}/conflicts`
    : `${getBasePath(workspaceId)}/conflicts`;
  return apiGet<{ data: ZoteroConflictItem[] }>(url);
}

export async function listZoteroPendingPushes(
  workspaceId: string,
  bindingId: string,
): Promise<{ data: ZoteroPendingPushItem[] }> {
  return apiGet<{ data: ZoteroPendingPushItem[] }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/pending-pushes`,
  );
}

export async function resolveZoteroConflict(
  workspaceId: string,
  bindingId: string,
  itemId: string,
  payload: ResolveConflictPayload,
): Promise<{ data: any }> {
  return apiPost<{ data: any }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/conflicts/${itemId}/resolve`,
    payload,
  );
}

export async function getZoteroKillSwitch(
  workspaceId: string,
): Promise<{ data: KillSwitchStatus }> {
  return apiGet<{ data: KillSwitchStatus }>(
    `${getBasePath(workspaceId)}/kill-switch`,
  );
}

export async function setZoteroKillSwitch(
  workspaceId: string,
  data: { disabled: boolean; reason?: string; workspaceId?: string },
): Promise<{ data: KillSwitchStatus }> {
  return apiPost<{ data: KillSwitchStatus }>(
    `${getBasePath(workspaceId)}/kill-switch`,
    data,
  );
}

export async function getZoteroStorageQuota(
  workspaceId: string,
  bindingId: string,
): Promise<{ data: StorageQuotaInfo }> {
  return apiGet<{ data: StorageQuotaInfo }>(
    `${getBasePath(workspaceId)}/bindings/${bindingId}/storage/quota`,
  );
}
