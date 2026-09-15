import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Sticky } from "@/features/projects/stickies/types/sticky.types";

export const normalizeSticky = (s: Partial<Sticky> | null | undefined): Sticky => {
  if (!s) {
    return {
      id: '',
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
    content: s.content || '',
    color: s.color || 'yellow-1',
  } as Sticky;
};

export const getStickies = async (
  _workspaceId?: string,
  search?: string,
  projectId?: string,
): Promise<Sticky[]> => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  const queryStr = params.toString() ? `?${params.toString()}` : "";

  const url = projectId
    ? `/api/projects/${projectId}/stickies${queryStr}`
    : `/api/me/stickies${queryStr}`;

  const data = await apiGet<{ stickies: Partial<Sticky>[] }>(url);
  return (data?.stickies || []).map(normalizeSticky);
};

export const createSticky = async (variables?: {
  workspaceId?: string;
  title?: string;
  content?: string;
  color?: string;
  position?: { x: number; y: number };
  projectId?: string;
}): Promise<Sticky> => {
  const { workspaceId: _w, ...payload } = variables || {};
  const url = variables?.projectId
    ? `/api/projects/${variables.projectId}/stickies`
    : `/api/me/stickies`;

  const res = await apiPost<{ sticky: Partial<Sticky> } | Partial<Sticky>>(
    url,
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

export const reorderStickies = async (
  _workspaceId?: string,
  stickyIds: string[] = [],
  projectId?: string,
) => {
  const url = projectId
    ? `/api/projects/${projectId}/stickies/reorder`
    : '/api/me/stickies/reorder';
  return apiPut(url, { stickyIds });
};

