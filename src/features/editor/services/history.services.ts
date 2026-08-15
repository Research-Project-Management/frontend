import { apiGet, apiPost } from "@/shared/lib/api";
import type { ProjectEvent } from "../types/document.types";

export const ProjectHistoryService = {
  getByProjectId: async (projectId: string) => {
    const res = await apiGet<{ events: ProjectEvent[] }>(`/api/project/${projectId}/history`);
    return res.events;
  },

  restoreToEvent: ({ rootPageId, eventId }: { rootPageId: string; eventId: string }) =>
    apiPost<ProjectEvent[]>(`/api/project/${rootPageId}/history/${eventId}/restore`, {}),
};
