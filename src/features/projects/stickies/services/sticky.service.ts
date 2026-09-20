import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/shared/lib/api";
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

export const getStickies = async (): Promise<Sticky[]> => {
  const data = await apiGet<{ stickies: Partial<Sticky>[] }>('/api/v1/stickies');
  return (data?.stickies || []).map(normalizeSticky);
};

export const getStickyById = async (stickyId: string): Promise<Sticky> => {
  const res = await apiGet<{ sticky: Partial<Sticky> } | Partial<Sticky>>(`/api/v1/stickies/${stickyId}`);
  const stickyData = res && 'sticky' in res ? res.sticky : res;
  return normalizeSticky(stickyData);
};

export const createSticky = async (variables?: {
  id?: string;
  title?: string;
  content?: string;
  color?: string;
  position?: { x: number; y: number };
}): Promise<Sticky> => {
  const res = await apiPost<{ sticky: Partial<Sticky> } | Partial<Sticky>>(
    '/api/v1/stickies',
    variables || {},
  );
  const stickyData = res && 'sticky' in res ? res.sticky : res;
  return normalizeSticky(stickyData);
};

export const updateSticky = async (stickyId: string, updates: Partial<Sticky>): Promise<Sticky> => {
  const { id: _ignoredId, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, ...payload } = updates as any;
  const res = await apiPatch<{ sticky: Partial<Sticky> } | Partial<Sticky>>(
    `/api/v1/stickies/${stickyId}`,
    payload,
  );
  const stickyData = res && 'sticky' in res ? res.sticky : res;
  return normalizeSticky(stickyData);
};

export const deleteSticky = async (stickyId: string) => {
  return apiDelete(`/api/v1/stickies/${stickyId}`);
};

export interface ReorderStickiesResponse {
  success: boolean;
  count: number;
  stickies?: Sticky[];
}

export const reorderStickies = async (
  stickyIds: string[] = [],
): Promise<ReorderStickiesResponse> => {
  const res = await apiPut<{ success?: boolean; count?: number; stickies?: Partial<Sticky>[] }>(
    '/api/v1/stickies/reorder',
    { stickyIds }
  );
  return {
    success: Boolean(res?.success),
    count: res?.count ?? 0,
    stickies: res?.stickies ? res.stickies.map(normalizeSticky) : undefined,
  };
};

