'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';

export interface UseRealtimeWorkItemsOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useRealtimeWorkItems({
  projectId,
  enabled = true,
}: UseRealtimeWorkItemsOptions) {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          const payload = JSON.parse(event.data) as {
            projectId?: string;
            workItemId?: string;
            entityId?: string;
            verb?: string;
          };
          if (!payload?.projectId || payload.projectId === projectId) {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['work-items'] });
              queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
              queryClient.invalidateQueries({ queryKey: ['project-states', projectId] });
              queryClient.invalidateQueries({ queryKey: ['project-state-counts', projectId] });
              queryClient.invalidateQueries({ queryKey: ['project-details', projectId] });
              queryClient.invalidateQueries({ queryKey: ['project-overview', projectId] });

              const targetId = payload?.workItemId || payload?.entityId;
              if (targetId) {
                queryClient.invalidateQueries({ queryKey: ['work-item-comments', targetId] });
                queryClient.invalidateQueries({ queryKey: ['work-item-activity', targetId] });
              }
            }, 75);
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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [projectId, enabled, queryClient]);
}
