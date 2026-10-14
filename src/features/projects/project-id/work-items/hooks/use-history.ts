'use client';

import { useQuery } from '@tanstack/react-query';
import { HistoryService } from '../api/work-item.api';

export const historyKeys = {
  activity: (id: string) => ['work-item-activity', id] as const,
  workItemActivity: (id: string) => ['work-item-activity', id] as const,
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

export const useWorkItemActivityLogs = useActivityLogs;
