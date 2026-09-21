'use client';

/**
 * use-notification-bundler.ts
 *
 * React Query hooks for Overleaf-style 10-minute review notification bundling.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationBundlerService } from '../services/notification-bundler.service';
import { toast } from 'sonner';

export const notificationBundlerKeys = {
  all: ['notification-bundler'] as const,
  bundles: () => [...notificationBundlerKeys.all, 'bundles'] as const,
  digests: () => [...notificationBundlerKeys.all, 'digests'] as const,
  settings: () => [...notificationBundlerKeys.all, 'settings'] as const,
};

export function usePendingBundles() {
  return useQuery({
    queryKey: notificationBundlerKeys.bundles(),
    queryFn: () => notificationBundlerService.getPendingBundles(),
    refetchInterval: 15_000, // Poll every 15s in background
  });
}

export function useDigestHistory(limit = 20) {
  return useQuery({
    queryKey: [...notificationBundlerKeys.digests(), limit],
    queryFn: () => notificationBundlerService.getDigestHistory(limit),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationBundlerKeys.settings(),
    queryFn: () => notificationBundlerService.getSettings(),
  });
}

export function useFlushBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scopeId,
      projectId,
    }: {
      scopeId?: string;
      projectId?: string;
    }) => notificationBundlerService.flushBundle(scopeId, projectId),
    onSuccess: (digest) => {
      queryClient.invalidateQueries({
        queryKey: notificationBundlerKeys.bundles(),
      });
      queryClient.invalidateQueries({
        queryKey: notificationBundlerKeys.digests(),
      });
      if (digest) {
        toast.success(`Notifications flushed: ${digest.summary}`);
      } else {
        toast.info('No pending notifications to flush');
      }
    },
    onError: () => {
      toast.error('Failed to flush notification bundle');
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: { enabled?: boolean; windowMinutes?: number }) =>
      notificationBundlerService.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationBundlerKeys.settings(),
      });
      toast.success('Notification bundling settings updated');
    },
    onError: () => {
      toast.error('Failed to update notification bundling settings');
    },
  });
}
