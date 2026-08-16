import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Sticky } from "@/features/workspaces/projects/project-id/stickies/types/sticky.types";

export const getStickies = async (projectId: string, search?: string) => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: Sticky[] }>(`/api/project/${projectId}/stickies${queryStr}`);
  return data.stickies;
};

export const createSticky = async (variables: {
  projectId: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
}) => {
  return apiPost<{ sticky: Sticky }>(`/api/project/${variables.projectId}/stickies`, variables);
};

export const updateSticky = async (stickyId: string, updates: Partial<Sticky>) => {
  return apiPut<{ sticky: Sticky }>(`/api/stickies/${stickyId}`, updates);
};

export const deleteSticky = async (stickyId: string) => {
  return apiDelete(`/api/stickies/${stickyId}`);
};

export const reorderStickies = async (projectId: string, stickyIds: string[]) => {
  return apiPut(`/api/project/${projectId}/stickies/reorder`, { stickyIds });
};
