import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";

export interface ItemUpdateRecord {
  id: string;
  itemId?: string;
  workItemId: string;
  taskId?: string;
  userId: string;
  content: string;
  status?: string | null;
  percent?: number | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}
export type WorkItemUpdateRecord = ItemUpdateRecord;

export const UpdateService = {
  getUpdates: async (workItemId: string, projectId?: string): Promise<WorkItemUpdateRecord[]> => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${workItemId}/updates`
      : `/api/work-items/${workItemId}/updates`;
    const res = await apiGet<{ data?: WorkItemUpdateRecord[]; updates?: WorkItemUpdateRecord[] } | WorkItemUpdateRecord[]>(url);
    if (Array.isArray(res)) return res;
    return res.data || res.updates || [];
  },

  getLatestUpdate: async (workItemId: string, projectId?: string): Promise<WorkItemUpdateRecord | null> => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${workItemId}/updates/latest`
      : `/api/work-items/${workItemId}/updates/latest`;
    const res = await apiGet<{ data?: WorkItemUpdateRecord } | WorkItemUpdateRecord | null>(url);
    if (!res) return null;
    if ("data" in res) return (res as { data?: WorkItemUpdateRecord }).data || null;
    return res as WorkItemUpdateRecord;
  },

  createUpdate: (
    workItemId: string,
    data: { content: string; status?: string; percent?: number },
    projectId?: string,
  ) => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${workItemId}/updates`
      : `/api/work-items/${workItemId}/updates`;
    return apiPost<WorkItemUpdateRecord>(url, data);
  },

  deleteUpdate: (workItemId: string, updateId: string, projectId?: string) => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${workItemId}/updates/${updateId}`
      : `/api/work-items/${workItemId}/updates/${updateId}`;
    return apiDelete<{ message: string }>(url);
  },
};
