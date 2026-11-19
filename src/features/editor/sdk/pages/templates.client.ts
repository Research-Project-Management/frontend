/**
 * templates.client.ts
 *
 * Templates & gallery sub-API: List, search, retrieve, instantiate, custom templates, scaffolding.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type { ProjectTemplateItem } from './types';

export const templates = {
  list: async (query?: { category?: string; search?: string; limit?: number; skip?: number; offset?: number }): Promise<ProjectTemplateItem[]> => {
    const params: Record<string, string> = {};
    if (query?.category) params.category = query.category;
    if (query?.search) params.search = query.search;
    if (query?.limit) params.limit = String(query.limit);
    if (query?.skip !== undefined) {
      params.skip = String(query.skip);
      params.offset = String(query.skip);
    } else if (query?.offset !== undefined) {
      params.offset = String(query.offset);
    }
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${PAGES_API_BASE}/templates`, { params });
    return Array.isArray(res) ? res : res?.templates || [];
  },

  search: async (query: { q?: string; category?: string; tags?: string[] }): Promise<ProjectTemplateItem[]> => {
    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${PAGES_API_BASE}/templates/search`, { params });
    return Array.isArray(res) ? res : res?.templates || [];
  },

  getById: async (id: string): Promise<ProjectTemplateItem | null> => {
    return await apiGet<ProjectTemplateItem>(`${PAGES_API_BASE}/templates/${id}`);
  },

  instantiate: async (templateId: string, projectName: string): Promise<{ projectId: string; [key: string]: unknown }> => {
    return await apiPost<{ projectId: string; [key: string]: unknown }>(`${PAGES_API_BASE}/templates/instantiate`, { templateId, projectName });
  },

  createCustom: async (dto: Record<string, unknown>): Promise<ProjectTemplateItem> => {
    return await apiPost<ProjectTemplateItem>(`${PAGES_API_BASE}/templates/custom`, dto);
  },

  scaffold: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(`${PAGES_API_BASE}/spaces/${projectId}/templates/${templateId}/scaffold`, {});
  },
};
