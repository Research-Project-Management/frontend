import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Sticky } from "@/features/workspaces/projects/stickies/types/sticky.types";

export const normalizeSticky = (s: Partial<Sticky> | null | undefined): Sticky => {
  if (!s) {
    return {
      id: '',
      workspaceId: '',
      content: '',
      color: 'yellow-1',
      title: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Sticky;
  }
  return {
    ...s,
    id: s.id || '',
    workspaceId: s.workspaceId || '',
    content: s.content || '',
    color: s.color || 'yellow-1',
  } as Sticky;
};

export const getStickies = async (workspaceId: string, search?: string, projectId?: string): Promise<Sticky[]> => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (projectId) params.append("projectId", projectId);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: Partial<Sticky>[] }>(`/api/workspace/${workspaceId}/stickies${queryStr}`);
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
  const { workspaceId, ...payload } = variables;
  const res = await apiPost<{ sticky: Partial<Sticky> } | Partial<Sticky>>(
    `/api/workspace/${workspaceId}/stickies`,
    payload,
  );
  const stickyData = res && 'sticky' in res ? res.sticky : res;
  return normalizeSticky(stickyData);
};

export const updateSticky = async (stickyId: string, updates: Partial<Sticky>): Promise<Sticky> => {
  const { id: _id, workspaceId: _wsId, createdAt: _ca, updatedAt: _ua, ...payload } = updates as any;
  const res = await apiPut<{ sticky: Partial<Sticky> } | Partial<Sticky>>(
    `/api/stickies/${stickyId}`,
    payload,
  );
  const stickyData = res && 'sticky' in res ? res.sticky : res;
  return normalizeSticky(stickyData);
};

export const deleteSticky = async (stickyId: string) => {
  return apiDelete(`/api/stickies/${stickyId}`);
};

export const reorderStickies = async (workspaceId: string, stickyIds: string[]) => {
  return apiPut(`/api/workspace/${workspaceId}/stickies/reorder`, { stickyIds });
};
