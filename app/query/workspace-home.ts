import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL;

// Types
export type RecentItem = {
  type: "page" | "project" | "file";
  id: string;
  name: string;
  icon: string;
  project?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  author: {
    _id: string;
    name: string;
    avatar?: string;
    email: string;
  };
  lastEdited: string;
};

export type Activity = {
  type: "page_update" | "file_upload" | "task_update";
  user: {
    _id: string;
    name: string;
    avatar?: string;
    email: string;
  };
  content: string;
  time: string;
  itemId: string;
};

// Get recent items
export const useRecentItems = (workspaceId: string) => {
  return useQuery({
    queryKey: ["workspace", workspaceId, "recent"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/recent`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch recent items");
      }
      const data = await response.json();
      return data.items as RecentItem[];
    },
    enabled: !!workspaceId,
  });
};

// Get activity feed
export const useActivityFeed = (workspaceId: string) => {
  return useQuery({
    queryKey: ["workspace", workspaceId, "activity"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/activity`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch activity feed");
      }
      const data = await response.json();
      return data.activities as Activity[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
