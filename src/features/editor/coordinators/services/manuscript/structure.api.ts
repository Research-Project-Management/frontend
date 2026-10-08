/**
 * structure.api.ts
 *
 * Project hierarchy, folder tree nodes, root document management sub-API.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { StructureNodeDto } from './types';

export const structure = {
  getTree: async (projectId: string) => {
    return await apiGet(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/tree`);
  },

  getAllNodes: async (projectId: string): Promise<StructureNodeDto[]> => {
    if (!projectId) return [];
    try {
      return await apiGet<StructureNodeDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, { silent: true });
    } catch {
      return [];
    }
  },

  getNodeById: async (projectId: string, nodeId: string): Promise<StructureNodeDto | null> => {
    if (!projectId || !nodeId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}`, { silent: true });
    } catch {
      return null;
    }
  },

  createNode: async (projectId: string, dto: any) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
      ...dto,
      type: typeof dto?.type === 'string' ? dto.type.toUpperCase() : (dto?.type || 'DOC'),
    });
  },

  moveNode: async (projectId: string, nodeId: string, dto: any) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/move`, dto);
  },

  renameNode: async (projectId: string, nodeId: string, dto: any) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/rename`, dto);
  },

  deleteNode: async (projectId: string, nodeId: string) => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}`);
  },

  getRootDoc: async (projectId: string): Promise<StructureNodeDto | null> => {
    if (!projectId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/root-doc`, { silent: true });
    } catch {
      return null;
    }
  },

  setRootDoc: async (projectId: string, nodeId: string): Promise<StructureNodeDto> => {
    return await apiPost<StructureNodeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/root-doc/${nodeId}`,
      {},
    );
  },

  reorderNode: async (projectId: string, nodeId: string, sortOrder: number): Promise<void> => {
    await apiPost(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/reorder`,
      { sortOrder },
    );
  },
};
