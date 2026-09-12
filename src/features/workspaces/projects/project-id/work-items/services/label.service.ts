import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/shared/lib/api";
import type { Label, CreateLabelInput, UpdateLabelInput } from "../types/label.types";

// ── Constants ────────────────────────────────────────────────────────────────

export const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" },
  { name: "yellow_subtle", color: "#f8e6a0" },
  { name: "orange_subtle", color: "#fedec8" },
  { name: "red_subtle", color: "#ffd5d2" },
  { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" },
  { name: "yellow", color: "#f5cd47" },
  { name: "orange", color: "#fea362" },
  { name: "red", color: "#f87168" },
  { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" },
  { name: "yellow_bold", color: "#946f00" },
  { name: "orange_bold", color: "#c25100" },
  { name: "red_bold", color: "#c9372c" },
  { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" },
  { name: "sky_subtle", color: "#c6edfb" },
  { name: "lime_subtle", color: "#d3f1a7" },
  { name: "pink_subtle", color: "#fdd0ec" },
  { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" },
  { name: "sky", color: "#60c6d2" },
  { name: "lime", color: "#94c748" },
  { name: "pink", color: "#e774bb" },
  { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" },
  { name: "sky_bold", color: "#1d7f8c" },
  { name: "lime_bold", color: "#5b7f24" },
  { name: "pink_bold", color: "#ae4787" },
  { name: "grey_bold", color: "#44546f" },
];

export const DEFAULT_LABEL_COLOR = "#4bce97";

// ── Pure Label API Service ───────────────────────────────────────────────────

export const LabelService = {
  // ── Project-Scoped Methods ─────────────────────────────────────────

  getProjectLabels: async (projectId: string): Promise<Label[]> => {
    const data = await apiGet<{ labels?: Label[] }>(`/api/projects/${projectId}/labels`);
    return data.labels ?? [];
  },

  createProjectLabel: async (projectId: string, input: { name: string; color?: string; description?: string; parentId?: string | null; sortOrder?: number }): Promise<Label> => {
    const data = await apiPost<{ label?: Label }>(`/api/projects/${projectId}/labels`, input);
    return data.label!;
  },

  updateProjectLabel: async (projectId: string, labelId: string, input: { name?: string; color?: string; description?: string | null; parentId?: string | null; sortOrder?: number }): Promise<Label> => {
    const data = await apiPatch<{ label?: Label }>(`/api/projects/${projectId}/labels/${labelId}`, input);
    return data.label!;
  },

  deleteProjectLabel: (projectId: string, labelId: string): Promise<void> =>
    apiDelete(`/api/projects/${projectId}/labels/${labelId}`),

  reorderProjectLabels: (projectId: string, labels: Array<{ id: string; sortOrder: number }>): Promise<void> =>
    apiPost(`/api/projects/${projectId}/labels/reorder`, { labels }),

  importProjectLabels: (projectId: string, labels: Array<{ name: string; color?: string; description?: string }>) =>
    apiPost<{ created: number; skipped: number; failed: number; labels: Label[] }>(`/api/projects/${projectId}/labels/import`, { labels }),

  // ── Workspace-Level Methods (Preserved for Backward Compatibility) ─────────

  list: async (workspaceId: string, type?: string, projectId?: string): Promise<Label[]> => {
    if (projectId) {
      return LabelService.getProjectLabels(projectId);
    }
    const params = new URLSearchParams();
    if (type) params.append("type", type);

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const data = await apiGet<any>(`/api/workspace/${workspaceId}/labels${queryStr}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.labels)) return data.labels;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  },

  create: ({ workspaceId, ...payload }: CreateLabelInput) => {
    const { projectId, ...cleanPayload } = payload as any;
    if (projectId) {
      return LabelService.createProjectLabel(projectId, cleanPayload);
    }
    return apiPost<{ label?: Label; tag?: Label }>(`/api/workspace/${workspaceId}/labels`, cleanPayload);
  },

  update: ({ labelId, ...payload }: UpdateLabelInput & { projectId?: string }) => {
    const { projectId, ...cleanPayload } = payload as any;
    if (projectId) {
      return LabelService.updateProjectLabel(projectId, labelId, cleanPayload);
    }
    return apiPut<{ label?: Label; tag?: Label }>(`/api/labels/${labelId}`, cleanPayload);
  },

  delete: (labelId: string, projectId?: string) => {
    if (projectId) {
      return LabelService.deleteProjectLabel(projectId, labelId);
    }
    return apiDelete(`/api/labels/${labelId}`);
  },
};

// ── Backward-compatible Function Aliases ─────────────────────────────────────

export const fetchLabels = LabelService.list;
export const createLabel = LabelService.create;
export const updateLabel = LabelService.update;
export const deleteLabel = LabelService.delete;
