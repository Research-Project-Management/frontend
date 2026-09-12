import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Item } from "../types/work-item.types";

export interface WorkItemTemplateRecord {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  title?: string | null;
  content?: string | null;
  priority?: string | null;
  labels?: string[];
  defaultCycleId?: string | null;
  defaultColumnId?: string | null;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TemplateService = {
  getTemplates: async (projectId: string): Promise<WorkItemTemplateRecord[]> => {
    const res = await apiGet<{ data?: WorkItemTemplateRecord[]; templates?: WorkItemTemplateRecord[] } | WorkItemTemplateRecord[]>(
      `/api/work-items/projects/${projectId}/templates`,
    );
    if (Array.isArray(res)) return res;
    return res.data || res.templates || [];
  },

  getTemplate: (projectId: string, templateId: string) =>
    apiGet<WorkItemTemplateRecord>(`/api/work-items/projects/${projectId}/templates/${templateId}`),

  createTemplate: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      title?: string;
      content?: string;
      priority?: string;
      labels?: string[];
      defaultCycleId?: string;
      defaultColumnId?: string;
      isShared?: boolean;
    },
  ) =>
    apiPost<WorkItemTemplateRecord>(`/api/work-items/projects/${projectId}/templates`, data),

  updateTemplate: (
    projectId: string,
    templateId: string,
    data: Partial<{
      name: string;
      description?: string;
      title?: string;
      content?: string;
      priority?: string;
      labels?: string[];
      defaultCycleId?: string;
      defaultColumnId?: string;
      isShared?: boolean;
    }>,
  ) =>
    apiPut<WorkItemTemplateRecord>(`/api/work-items/projects/${projectId}/templates/${templateId}`, data),

  deleteTemplate: (projectId: string, templateId: string) =>
    apiDelete<{ message: string }>(`/api/work-items/projects/${projectId}/templates/${templateId}`),

  instantiateTemplate: (
    projectId: string,
    templateId: string,
    data?: { title?: string; overrides?: Record<string, unknown> },
  ) =>
    apiPost<{ message: string; task: Item; item?: Item }>(
      `/api/work-items/projects/${projectId}/templates/${templateId}/instantiate`,
      data || {},
    ),
};
