'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';
import { toast } from 'sonner';

export interface UseRealtimeWorkItemsOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useRealtimeWorkItems({
  projectId,
  enabled = true,
}: UseRealtimeWorkItemsOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !projectId || typeof window === 'undefined') return;

    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const sseUrl = `${baseUrl}/api/projects/${projectId}/work-items/events${tokenQuery}`;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { projectId?: string };
          if (payload?.projectId === projectId) {
            queryClient.invalidateQueries({ queryKey: ['work-items'] });
            queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
            toast.info('Dữ liệu công việc vừa được đồng bộ thời gian thực.', {
              id: 'realtime-sync',
              duration: 2500,
            });
          }
        } catch {
          // ignore non-json messages
        }
      };

      eventSource.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch {
      // ignore initialization error
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [projectId, enabled, queryClient]);
}
