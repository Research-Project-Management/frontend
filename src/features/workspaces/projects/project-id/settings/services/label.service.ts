import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/shared/lib/api";
import type {
  Label,
  CreateLabelInput,
  UpdateLabelInput,
  CreateProjectLabelInput,
  UpdateProjectLabelInput,
  ReorderLabelItem,
  ImportLabelRow,
  ImportLabelResult,
  LabelType,
} from '../types/label.types';

// ── API Services ──────────────────────────────────────────────────────────────

export const LabelService = {
  // ── 1. Project-Scoped Methods ─────────────────────────────────────────────

  getProjectLabels: async (projectId: string): Promise<Label[]> => {
    const data = await apiGet<{ labels?: Label[] }>(
      `/api/projects/${projectId}/labels`,
    );
    return data.labels ?? [];
  },

  createProjectLabel: async (
    projectId: string,
    input: CreateProjectLabelInput,
  ): Promise<Label> => {
    const data = await apiPost<{ label?: Label }>(
      `/api/projects/${projectId}/labels`,
      input,
    );
    return data.label!;
  },

  updateProjectLabel: async (
    projectId: string,
    labelId: string,
    input: UpdateProjectLabelInput,
  ): Promise<Label> => {
    const data = await apiPatch<{ label?: Label }>(
      `/api/projects/${projectId}/labels/${labelId}`,
      input,
    );
    return data.label!;
  },

  deleteProjectLabel: async (
    projectId: string,
    labelId: string,
  ): Promise<void> => {
    await apiDelete<{ message?: string }>(
      `/api/projects/${projectId}/labels/${labelId}`,
    );
  },

  reorderProjectLabels: async (
    projectId: string,
    labels: ReorderLabelItem[],
  ): Promise<void> => {
    await apiPost<{ message?: string }>(
      `/api/projects/${projectId}/labels/reorder`,
      { labels },
    );
  },

  importProjectLabels: async (
    projectId: string,
    labels: ImportLabelRow[],
  ): Promise<ImportLabelResult> => {
    return apiPost<ImportLabelResult>(
      `/api/projects/${projectId}/labels/import`,
      { labels },
    );
  },

  // ── 2. Legacy Workspace-Level Methods (Preserved for Backward Compatibility) ──

  list: async (workspaceId: string, type?: LabelType, projectId?: string): Promise<Label[]> => {
    if (projectId) {
      return LabelService.getProjectLabels(projectId);
    }
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    const queryStr = params.toString() ? `?${params.toString()}` : '';

    const data = await apiGet<{ labels?: Label[] }>(
      `/api/workspace/${workspaceId}/labels${queryStr}`,
    );
    return data.labels ?? [];
  },

  create: async (workspaceId: string, input: CreateLabelInput & { projectId?: string }): Promise<Label> => {
    if (input.projectId) {
      return LabelService.createProjectLabel(input.projectId, input as CreateProjectLabelInput);
    }
    const data = await apiPost<{ label?: Label }>(
      `/api/workspace/${workspaceId}/labels`,
      input,
    );
    return data.label!;
  },

  update: async (labelId: string, input: UpdateLabelInput): Promise<Label> => {
    const data = await apiPut<{ label?: Label }>(
      `/api/labels/${labelId}`,
      input,
    );
    return data.label!;
  },

  delete: async (labelId: string): Promise<void> => {
    await apiDelete<{ message?: string }>(`/api/labels/${labelId}`);
  },
};

// Aliases
export const fetchLabels = LabelService.list;
export const createLabel = LabelService.create;
export const updateLabel = LabelService.update;
export const deleteLabel = LabelService.delete;
