import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type {
  WorkItemState,
  StateGroup,
} from "@/features/workspaces/projects/project-id/work-items/types/types";

export interface CreateStateInput {
  name: string;
  color?: string;
  group: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface UpdateStateInput {
  name?: string;
  color?: string;
  group?: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface ReorderStateItem {
  id: string;
  sequence?: number;
  group?: StateGroup;
  title?: string;
  accentColor?: string;
}

export const StateService = {
  getStates: async (projectId: string) => {
    const res = await apiGet<{ states: WorkItemState[]; columns: WorkItemState[] }>(
      `/api/projects/${projectId}/states`,
    );
    return res.states || res.columns || [];
  },

  getStateCounts: async (projectId: string) => {
    return apiGet<Record<string, number>>(
      `/api/projects/${projectId}/states/counts`,
    );
  },

  createState: async (projectId: string, data: CreateStateInput) => {
    return apiPost<{
      state: WorkItemState;
      states: WorkItemState[];
      columns: WorkItemState[];
    }>(`/api/projects/${projectId}/states`, data);
  },

  updateState: async (
    projectId: string,
    stateId: string,
    data: UpdateStateInput,
  ) => {
    return apiPut<{
      state: WorkItemState;
      states: WorkItemState[];
      columns: WorkItemState[];
    }>(`/api/projects/${projectId}/states/${stateId}`, data);
  },

  reorderStates: async (projectId: string, states: ReorderStateItem[]) => {
    return apiPut<{
      states: WorkItemState[];
      columns: WorkItemState[];
    }>(`/api/projects/${projectId}/states/reorder`, { states });
  },

  deleteState: async (
    projectId: string,
    stateId: string,
    fallbackStateId?: string,
  ) => {
    return apiDelete<{
      states: WorkItemState[];
      columns: WorkItemState[];
      migratedTo?: string;
    }>(
      `/api/projects/${projectId}/states/${stateId}${
        fallbackStateId ? `?fallbackStateId=${fallbackStateId}` : ""
      }`,
    );
  },

  resetStates: async (projectId: string) => {
    return apiPost<{
      states: WorkItemState[];
      columns: WorkItemState[];
    }>(`/api/projects/${projectId}/states/reset`, {});
  },
};
