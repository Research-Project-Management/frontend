import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Item, CreateItemInput } from "../types/work-item.types";

export interface WorkItemDraftRecord {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  content?: string | null;
  priority?: string | null;
  columnId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  cycleId?: string | null;
  parentWorkItemId?: string | null;
  labels?: string[];
  assigneeId?: string | null;
  attachments?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const DraftService = {
  getDrafts: async (projectId?: string): Promise<WorkItemDraftRecord[]> => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await apiGet<{ data?: WorkItemDraftRecord[]; drafts?: WorkItemDraftRecord[] } | WorkItemDraftRecord[]>(
      `/api/work-items/drafts${query}`,
    );
    if (Array.isArray(res)) return res;
    return res.data || res.drafts || [];
  },

  getDraft: (id: string) =>
    apiGet<WorkItemDraftRecord>(`/api/work-items/drafts/${id}`),

  createDraft: (data: Partial<CreateItemInput> & { projectId: string }) =>
    apiPost<WorkItemDraftRecord>(`/api/work-items/drafts`, data),

  updateDraft: (id: string, data: Partial<CreateItemInput>) =>
    apiPut<WorkItemDraftRecord>(`/api/work-items/drafts/${id}`, data),

  publishDraft: (id: string, options?: { columnId?: string }) =>
    apiPost<{ message: string; workItem: Item; item?: Item }>(`/api/work-items/drafts/${id}/publish`, options || {}),

  duplicateDraft: (id: string) =>
    apiPost<WorkItemDraftRecord>(`/api/work-items/drafts/${id}/duplicate`),

  deleteDraft: (id: string) =>
    apiDelete<{ message: string }>(`/api/work-items/drafts/${id}`),
};
