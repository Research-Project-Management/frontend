'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import { SyncService } from '../services/sync.service';

// ── Canonical Query Keys ───────────────────────────────────────────────────────
export const syncKeys = {
  all: (workspaceId: string) => ['sync', workspaceId] as const,
  pull: (workspaceId: string, sinceSeq: bigint, limit: number) =>
    ['sync', workspaceId, sinceSeq.toString(), limit] as const,
};

// ── useSyncPull ───────────────────────────────────────────────────────────────
/**
 * Pull delta changes from the server since a given sequence number.
 * Backed by GET /sync/pull?sinceSeq=...&limit=...
 */
export function useSyncPull(workspaceId: string, sinceSeq: bigint = 0n, limit = 100) {
  return useQuery({
    queryKey: syncKeys.pull(workspaceId, sinceSeq, limit),
    queryFn: () => SyncService.pull(workspaceId, sinceSeq, limit),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
  });
}

// ── useSyncPush ───────────────────────────────────────────────────────────────
/**
 * Push local mutations to the server.
 * Backed by POST /sync/push
 */
export function useSyncPush(workspaceId: string) {
  return useMutation({
    mutationFn: (
      mutations: Array<{
        entityType: string;
        entityId: string;
        action: 'create' | 'update' | 'delete';
        version: number;
        data?: unknown;
      }>,
    ) => SyncService.push(workspaceId, mutations),
    onError: (err: unknown) => {
      toast.error('Sync failed', {
        description: getErrorMessage(err) || 'Could not push local mutations to server.',
        id: 'sync-push',
      });
    },
  });
}

// ── useResync ─────────────────────────────────────────────────────────────────
/**
 * Trigger a full re-sync from the server.
 * Backed by POST /sync/resync
 */
export function useResync(workspaceId: string) {
  return useMutation({
    mutationFn: () => SyncService.resync(workspaceId),
    onSuccess: () => {
      toast.info('Syncing library', {
        description: 'Reconciling local catalog cache with remote server.',
        id: 'resync',
      });
    },
    onError: (err: unknown) => {
      toast.error('Sync failed', {
        description: getErrorMessage(err) || 'Could not synchronize library data.',
        id: 'resync',
      });
    },
  });
}
