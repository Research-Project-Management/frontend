import { apiGet } from "@/shared/lib/api";
import type { ActivityLog } from "../types/work-item.types";

export interface HistoryItem {
  id: string;
  itemId?: string;
  taskId?: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  createdAt: string;
}

export const HistoryService = {
  getActivityLogs: (itemId: string) =>
    apiGet<ActivityLog[] | { activities?: ActivityLog[]; data?: ActivityLog[] }>(
      `/api/work-items/${itemId}/activity`
    ),

  getHistory: (itemId: string) =>
    apiGet<HistoryItem[] | { history?: HistoryItem[]; data?: HistoryItem[] }>(
      `/api/work-items/${itemId}/history`
    ),

  getTransitions: (itemId: string) =>
    apiGet<unknown[]>(`/api/work-items/${itemId}/transitions`),

  getFeed: (itemId: string) =>
    apiGet<unknown[]>(`/api/work-items/${itemId}/feed`),
  getWorkItemFeed: (itemId: string) => HistoryService.getFeed(itemId),
};
