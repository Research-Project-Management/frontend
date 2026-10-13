'use client';

/**
 * use-notification-bundler.ts
 *
 * React Query hooks for Overleaf-style 10-minute review notification bundling.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
const notificationBundlerService = manuscriptService.notifications;
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
    enabled: false,
    refetchInterval: false,
    initialData: [],
  });
}

export function useDigestHistory(limit = 20) {
  return useQuery({
    queryKey: [...notificationBundlerKeys.digests(), limit],
    queryFn: () => notificationBundlerService.getDigestHistory(limit),
    enabled: false,
    initialData: [],
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationBundlerKeys.settings(),
    queryFn: () => notificationBundlerService.getSettings(),
    enabled: false,
    initialData: { enabled: false, windowMinutes: 10 },
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
        toast.success(`Notifications flushed: ${digest.summary}`, { id: 'flush-bundle' });
      } else {
        toast.info('No pending notifications to flush', { id: 'flush-bundle' });
      }
    },
    onError: () => {
      toast.error('Failed to flush notification bundle', { id: 'flush-bundle' });
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
      toast.success('Notification bundling settings updated', { id: 'update-notification-settings' });
    },
    onError: () => {
      toast.error('Failed to update notification bundling settings', { id: 'update-notification-settings' });
    },
  });
}
