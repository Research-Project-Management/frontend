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

export const getStickies = async (workspaceId?: string, search?: string, projectId?: string): Promise<Sticky[]> => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  const queryStr = params.toString() ? `?${params.toString()}` : "";

  const endpoint = projectId
    ? `/api/projects/${projectId}/stickies${queryStr}`
    : workspaceId
    ? `/api/workspace/${workspaceId}/stickies${queryStr}`
    : `/api/me/stickies${queryStr}`;

  const data = await apiGet<{ stickies: Partial<Sticky>[] }>(endpoint);
  return (data?.stickies || []).map(normalizeSticky);
};

export const createSticky = async (variables: {
  workspaceId?: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
  projectId?: string;
}): Promise<Sticky> => {
  const { workspaceId, projectId, ...payload } = variables;
  const endpoint = projectId
    ? `/api/projects/${projectId}/stickies`
    : workspaceId
    ? `/api/workspace/${workspaceId}/stickies`
    : `/api/me/stickies`;

  const res = await apiPost<{ sticky: Partial<Sticky> } | Partial<Sticky>>(
    endpoint,
    payload,
  );
  const stickyData = res && 'sticky' in res ? res.sticky : res;
  return normalizeSticky(stickyData);
};

export const updateSticky = async (stickyId: string, updates: Partial<Sticky>): Promise<Sticky> => {
  const { id: _ignoredId, workspaceId: _ignoredWorkspaceId, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, ...payload } = updates as any;
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

export const reorderStickies = async (workspaceId?: string, stickyIds: string[] = [], projectId?: string) => {
  const endpoint = projectId
    ? `/api/projects/${projectId}/stickies/reorder`
    : workspaceId
    ? `/api/workspace/${workspaceId}/stickies/reorder`
    : `/api/me/stickies/reorder`;
  return apiPut(endpoint, { stickyIds });
};
