import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type {
  WorkItemDraft,
  CreateDraftInput,
  UpdateDraftInput,
  PublishDraftInput,
  DraftQueryFilter,
  DraftListResponse,
} from '../types/draft.types';

export const DraftService = {
  getMyDrafts: async (filter?: DraftQueryFilter): Promise<DraftListResponse> => {
    const params: Record<string, string> = {};
    if (filter?.projectId && filter.projectId !== 'all') {
      params.projectId = filter.projectId;
    }
    if (filter?.search && filter.search.trim()) {
      params.search = filter.search.trim();
    }
    if (filter?.page) {
      params.page = String(filter.page);
    }
    if (filter?.limit) {
      params.limit = String(filter.limit);
    }

    const res = await apiGet<DraftListResponse>('/api/work-items/drafts', { params });
    return res;
  },

  getDraft: async (id: string): Promise<WorkItemDraft> => {
    const res = await apiGet<WorkItemDraft>(`/api/work-items/drafts/${id}`);
    return res;
  },

  createDraft: async (input: CreateDraftInput): Promise<WorkItemDraft> => {
    const res = await apiPost<WorkItemDraft>('/api/work-items/drafts', input);
    return res;
  },

  updateDraft: async (id: string, input: UpdateDraftInput): Promise<WorkItemDraft> => {
    const res = await apiPut<WorkItemDraft>(`/api/work-items/drafts/${id}`, input);
    return res;
  },

  deleteDraft: async (id: string): Promise<{ success: boolean; id: string }> => {
    const res = await apiDelete<{ success: boolean; id: string }>(`/api/work-items/drafts/${id}`);
    return res;
  },

  publishDraft: async (
    id: string,
    input: PublishDraftInput,
  ): Promise<{ task: any; [key: string]: any }> => {
    const res = await apiPost<{ task: any; [key: string]: any }>(
      `/api/work-items/drafts/${id}/publish`,
      input,
    );
    return res;
  },

  duplicateDraft: async (id: string): Promise<WorkItemDraft> => {
    const res = await apiPost<WorkItemDraft>(`/api/work-items/drafts/${id}/duplicate`, {});
    return res;
  },
};
