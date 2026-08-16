import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Sticky } from "@/features/workspaces/projects/stickies/types/sticky.types";

export const getStickies = async (workspaceId: string, search?: string, projectId?: string) => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (projectId) params.append("projectId", projectId);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: Sticky[] }>(`/api/workspace/${workspaceId}/stickies${queryStr}`);
  return data.stickies;
};

export const createSticky = async (variables: {
  workspaceId: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
}) => {
  return apiPost<{ sticky: Sticky }>(`/api/workspace/${variables.workspaceId}/stickies`, variables);
};

export const updateSticky = async (stickyId: string, updates: Partial<Sticky>) => {
  return apiPut<{ sticky: Sticky }>(`/api/stickies/${stickyId}`, updates);
};

export const deleteSticky = async (stickyId: string) => {
  return apiDelete(`/api/stickies/${stickyId}`);
};

export const reorderStickies = async (workspaceId: string, stickyIds: string[]) => {
  return apiPut(`/api/workspace/${workspaceId}/stickies/reorder`, { stickyIds });
};
