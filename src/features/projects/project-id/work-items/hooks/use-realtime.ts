'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';
import type { UseRealtimeWorkItemsOptions } from '@/features/projects/project-id/work-items/types/hook.types';

export type { UseRealtimeWorkItemsOptions };

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
              if (typeof document !== 'undefined' && document.hidden) {
                return;
              }

              // Invalidate core work items for this project
              queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });

              // Only invalidate state counts if the event is a state/column change
              if (!payload?.verb || payload.verb.includes('state') || payload.verb.includes('column') || payload.verb.includes('delete') || payload.verb.includes('create')) {
                queryClient.invalidateQueries({ queryKey: ['project-states', projectId] });
                queryClient.invalidateQueries({ queryKey: ['project-state-counts', projectId] });
              }

              const targetId = payload?.workItemId || payload?.entityId;
              if (targetId) {
                queryClient.invalidateQueries({ queryKey: ['work-item-comments', targetId] });
                queryClient.invalidateQueries({ queryKey: ['work-item-activity', targetId] });
              }
            }, 300);
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
