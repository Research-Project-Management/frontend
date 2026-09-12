'use client';

import { useQuery } from '@tanstack/react-query';
import { HistoryService } from '../services/history.service';

export const historyKeys = {
  activity: (id: string) => ['work-item-activity', id] as const,
  workItemActivity: (id: string) => ['work-item-activity', id] as const,
  history: (id: string) => ['work-item-history', id] as const,
  feed: (id: string) => ['work-item-feed', id] as const,
};

export const useActivityLogs = (id: string) =>
  useQuery({
    queryKey: historyKeys.activity(id),
    queryFn: async () => {
      try {
        const res = await HistoryService.getActivityLogs(id);
        if (Array.isArray(res)) return res;
        if (res && 'activities' in res && Array.isArray(res.activities)) return res.activities;
        if (res && 'data' in res && Array.isArray(res.data)) return res.data;
        return [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(id),
  });

export const useTaskActivityLogs = useActivityLogs;
export const useWorkItemActivityLogs = useActivityLogs;

export const useItemHistory = (id: string) =>
  useQuery({
    queryKey: historyKeys.history(id),
    queryFn: async () => {
      const res = await HistoryService.getHistory(id);
      if (Array.isArray(res)) return res;
      if (res && 'history' in res && Array.isArray(res.history)) return res.history;
      if (res && 'data' in res && Array.isArray(res.data)) return res.data;
      return [];
    },
    enabled: Boolean(id),
  });

export const useTaskHistory = useItemHistory;

export const useItemFeed = (id: string) =>
  useQuery({
    queryKey: historyKeys.feed(id),
    queryFn: () => HistoryService.getFeed(id),
    enabled: Boolean(id),
  });

export const useWorkItemFeed = useItemFeed;
