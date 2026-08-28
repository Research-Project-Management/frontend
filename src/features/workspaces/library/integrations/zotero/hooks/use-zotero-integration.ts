import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  zoteroKeys,
  listZoteroConnections,
  createZoteroConnection,
  revokeZoteroConnection,
  listRemoteLibraries,
  createZoteroBinding,
  listZoteroBindings,
  updateZoteroSyncDirection,
  triggerZoteroPull,
  triggerZoteroReconcile,
  pushZoteroItem,
  listZoteroConflicts,
  listZoteroPendingPushes,
  resolveZoteroConflict,
  getZoteroKillSwitch,
  setZoteroKillSwitch,
  getZoteroStorageQuota,
} from '../services/zotero.service';
import type {
  ResolveConflictPayload,
  ZoteroConnection,
  ZoteroBinding,
  ZoteroConflictItem,
  ZoteroPendingPushItem,
  KillSwitchStatus,
  StorageQuotaInfo,
} from '../types/zotero.types';

export function useZoteroIntegration(workspaceId: string, selectedBindingId?: string) {
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery({
    queryKey: zoteroKeys.connections(workspaceId),
    queryFn: () => listZoteroConnections(workspaceId),
    enabled: !!workspaceId,
  });

  const bindingsQuery = useQuery({
    queryKey: zoteroKeys.bindings(workspaceId),
    queryFn: () => listZoteroBindings(workspaceId),
    enabled: !!workspaceId,
  });

  const conflictsQuery = useQuery({
    queryKey: zoteroKeys.conflicts(workspaceId, selectedBindingId),
    queryFn: () => listZoteroConflicts(workspaceId, selectedBindingId),
    enabled: !!workspaceId,
  });

  const pendingPushesQuery = useQuery({
    queryKey: zoteroKeys.pendingPushes(workspaceId, selectedBindingId),
    queryFn: () =>
      selectedBindingId
        ? listZoteroPendingPushes(workspaceId, selectedBindingId)
        : Promise.resolve({ data: [] }),
    enabled: !!workspaceId && !!selectedBindingId,
  });

  const killSwitchQuery = useQuery({
    queryKey: zoteroKeys.killSwitch(workspaceId),
    queryFn: () => getZoteroKillSwitch(workspaceId),
    enabled: !!workspaceId,
  });

  const storageQuotaQuery = useQuery({
    queryKey: zoteroKeys.storageQuota(workspaceId, selectedBindingId || ''),
    queryFn: () =>
      selectedBindingId
        ? getZoteroStorageQuota(workspaceId, selectedBindingId)
        : Promise.resolve({
            data: {
              total: 0,
              used: 0,
              available: 0,
              isExceeded: false,
              isUnavailable: true,
            },
          }),
    enabled: !!workspaceId && !!selectedBindingId,
  });

  const connectMutation = useMutation({
    mutationFn: (data: { apiKey: string; accountName?: string }) =>
      createZoteroConnection(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.connections(workspaceId) });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (connectionId: string) =>
      revokeZoteroConnection(workspaceId, connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.connections(workspaceId) });
      queryClient.invalidateQueries({ queryKey: zoteroKeys.bindings(workspaceId) });
    },
  });

  const createBindingMutation = useMutation({
    mutationFn: (data: {
      connectionId: string;
      remoteLibraryType?: 'user' | 'group';
      remoteLibraryId: string;
      syncDirection?: 'read_only' | 'two_way';
    }) => createZoteroBinding(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.bindings(workspaceId) });
    },
  });

  const updateSyncDirectionMutation = useMutation({
    mutationFn: ({
      bindingId,
      direction,
    }: {
      bindingId: string;
      direction: 'read_only' | 'two_way';
    }) => updateZoteroSyncDirection(workspaceId, bindingId, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.bindings(workspaceId) });
    },
  });

  const pullMutation = useMutation({
    mutationFn: (bindingId: string) => triggerZoteroPull(workspaceId, bindingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.bindings(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['library', 'papers', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['library', 'collections', workspaceId] });
      queryClient.invalidateQueries({ queryKey: zoteroKeys.conflicts(workspaceId) });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: (bindingId: string) => triggerZoteroReconcile(workspaceId, bindingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.bindings(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['library', 'papers', workspaceId] });
    },
  });

  const pushMutation = useMutation({
    mutationFn: ({ bindingId, itemId }: { bindingId: string; itemId: string }) =>
      pushZoteroItem(workspaceId, bindingId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.bindings(workspaceId) });
      queryClient.invalidateQueries({ queryKey: zoteroKeys.pendingPushes(workspaceId) });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: ({
      bindingId,
      itemId,
      payload,
    }: {
      bindingId: string;
      itemId: string;
      payload: ResolveConflictPayload;
    }) => resolveZoteroConflict(workspaceId, bindingId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.conflicts(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['library', 'papers', workspaceId] });
    },
  });

  const setKillSwitchMutation = useMutation({
    mutationFn: (data: { disabled: boolean; reason?: string; workspaceId?: string }) =>
      setZoteroKillSwitch(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: zoteroKeys.killSwitch(workspaceId) });
    },
  });

  const fetchRemoteLibraries = async (connectionId: string) => {
    const res = await listRemoteLibraries(workspaceId, connectionId);
    return res.data || [];
  };

  return {
    connections: (Array.isArray(connectionsQuery.data)
      ? connectionsQuery.data
      : (connectionsQuery.data as any)?.data || []) as ZoteroConnection[],
    isLoadingConnections: connectionsQuery.isLoading,
    bindings: (Array.isArray(bindingsQuery.data)
      ? bindingsQuery.data
      : (bindingsQuery.data as any)?.data || []) as ZoteroBinding[],
    isLoadingBindings: bindingsQuery.isLoading,
    conflicts: (Array.isArray(conflictsQuery.data)
      ? conflictsQuery.data
      : (conflictsQuery.data as any)?.data || []) as ZoteroConflictItem[],
    isLoadingConflicts: conflictsQuery.isLoading,
    pendingPushes: (Array.isArray(pendingPushesQuery.data)
      ? pendingPushesQuery.data
      : (pendingPushesQuery.data as any)?.data || []) as ZoteroPendingPushItem[],
    isLoadingPendingPushes: pendingPushesQuery.isLoading,
    killSwitch: ((killSwitchQuery.data as any)?.data || killSwitchQuery.data) as KillSwitchStatus | undefined,
    isLoadingKillSwitch: killSwitchQuery.isLoading,
    storageQuota: ((storageQuotaQuery.data as any)?.data || storageQuotaQuery.data) as StorageQuotaInfo | undefined,
    isLoadingQuota: storageQuotaQuery.isLoading,
    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    revoke: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
    createBinding: createBindingMutation.mutateAsync,
    isCreatingBinding: createBindingMutation.isPending,
    updateSyncDirection: updateSyncDirectionMutation.mutateAsync,
    isUpdatingSyncDirection: updateSyncDirectionMutation.isPending,
    pull: pullMutation.mutateAsync,
    isPulling: pullMutation.isPending,
    reconcile: reconcileMutation.mutateAsync,
    isReconciling: reconcileMutation.isPending,
    pushItem: pushMutation.mutateAsync,
    isPushingItem: pushMutation.isPending,
    resolveConflict: resolveConflictMutation.mutateAsync,
    isResolvingConflict: resolveConflictMutation.isPending,
    setKillSwitch: setKillSwitchMutation.mutateAsync,
    isSettingKillSwitch: setKillSwitchMutation.isPending,
    fetchRemoteLibraries,
  };
}
