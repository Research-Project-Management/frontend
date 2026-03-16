import { useQuery } from "@tanstack/react-query";
import { apiGet } from "~/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecentItem = {
  type: "page" | "project" | "file";
  id: string;
  name: string;
  icon: string;
  project?: { _id: string; name: string; avatar?: string };
  author: { _id: string; name: string; avatar?: string; email: string };
  lastEdited: string;
};

export type Activity = {
  type: "page_update" | "file_upload" | "task_update";
  user: { _id: string; name: string; avatar?: string; email: string };
  content: string;
  time: string;
  itemId: string;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const useRecentItems = (workspaceId: string) =>
  useQuery({
    queryKey: ["workspace", workspaceId, "recent"],
    queryFn: async () => {
      const data = await apiGet<{ items: RecentItem[] }>(`/api/workspace/${workspaceId}/recent`);
      return data.items;
    },
    enabled: !!workspaceId,
  });

export const useActivityFeed = (workspaceId: string) =>
  useQuery({
    queryKey: ["workspace", workspaceId, "activity"],
    queryFn: async () => {
      const data = await apiGet<{ activities: Activity[] }>(`/api/workspace/${workspaceId}/activity`);
      return data.activities;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
