/**
 * templates.api.ts
 *
 * Templates & gallery sub-API: List, search, retrieve, instantiate, custom templates, scaffolding.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';

export const templates = {
  list: async (query?: { category?: string; search?: string; limit?: number; skip?: number }): Promise<any[]> => {
    const params: Record<string, string> = {};
    if (query?.category) params.category = query.category;
    if (query?.search) params.search = query.search;
    if (query?.limit) params.limit = String(query.limit);
    if (query?.skip) params.skip = String(query.skip);
    try {
      const res = await apiGet<any>(`${MANUSCRIPTS_API_BASE}/projects/templates`, { params });
      return Array.isArray(res) ? res : res?.templates || [];
    } catch {
      const res = await apiGet<any>(`${MANUSCRIPTS_API_BASE}/templates`, { params });
      return Array.isArray(res) ? res : res?.templates || [];
    }
  },

  search: async (query: { q?: string; category?: string; tags?: string[] }): Promise<any> => {
    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/templates/search`, { params });
  },

  getById: async (id: string): Promise<any> => {
    try {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/projects/templates/${id}`);
    } catch {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/templates/${id}`);
    }
  },

  instantiate: async (templateId: string, projectName: string): Promise<any> => {
    return await apiPost<any>(`${MANUSCRIPTS_API_BASE}/templates/instantiate`, { templateId, projectName });
  },

  createCustom: async (dto: any): Promise<any> => {
    return await apiPost<any>(`${MANUSCRIPTS_API_BASE}/templates/custom`, dto);
  },

  scaffold: async (projectId: string, templateId: string): Promise<any> => {
    try {
      return await apiPost<any>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`,
        { templateId },
      );
    } catch {
      return await apiPost<any>(`${MANUSCRIPTS_API_BASE}/templates/scaffold`, { projectId, templateId });
    }
  },
};
