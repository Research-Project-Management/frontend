import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Sticky } from "@/features/workspaces/projects/stickies/types/sticky.types";

export const normalizeSticky = (s: any): Sticky => {
  if (!s) return s;
  const id = s._id || s.id || '';
  return {
    ...s,
    _id: id,
    id: id,
  };
};

export const getStickies = async (workspaceId: string, search?: string, projectId?: string): Promise<Sticky[]> => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (projectId) params.append("projectId", projectId);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: any[] }>(`/api/workspace/${workspaceId}/stickies${queryStr}`);
  return (data?.stickies || []).map(normalizeSticky);
};

export const createSticky = async (variables: {
  workspaceId: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
  projectId?: string;
}): Promise<Sticky> => {
  const res = await apiPost<{ sticky: any }>(`/api/workspace/${variables.workspaceId}/stickies`, variables);
  return normalizeSticky(res?.sticky || res);
};

export const updateSticky = async (stickyId: string, updates: Partial<Sticky>): Promise<Sticky> => {
  const res = await apiPut<{ sticky: any }>(`/api/stickies/${stickyId}`, updates);
  return normalizeSticky(res?.sticky || res);
};

export const deleteSticky = async (stickyId: string) => {
  return apiDelete(`/api/stickies/${stickyId}`);
};

export const reorderStickies = async (workspaceId: string, stickyIds: string[]) => {
  return apiPut(`/api/workspace/${workspaceId}/stickies/reorder`, { stickyIds });
};
