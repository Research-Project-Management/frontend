import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";

export interface CycleLabel {
  _id: string;
  name: string;
  color: string;
  type?: string;
  projectId?: string;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const AVAILABLE_LABEL_COLORS = [
  { name: "slate", color: "#64748b" },
  { name: "red", color: "#ef4444" },
  { name: "orange", color: "#f97316" },
  { name: "amber", color: "#f59e0b" },
  { name: "green", color: "#10b981" },
  { name: "emerald", color: "#059669" },
  { name: "teal", color: "#14b8a6" },
  { name: "cyan", color: "#06b6d4" },
  { name: "sky", color: "#0ea5e9" },
  { name: "blue", color: "#3b82f6" },
  { name: "indigo", color: "#6366f1" },
  { name: "violet", color: "#8b5cf6" },
  { name: "purple", color: "#a855f7" },
  { name: "fuchsia", color: "#d946ef" },
  { name: "pink", color: "#ec4899" },
  { name: "rose", color: "#f43f5e" },
] as const;

export const DEFAULT_LABEL_COLOR = "#3b82f6";

export const CycleLabelService = {
  list: (workspaceId: string, type: string = "cycle", projectId?: string) =>
    apiGet<CycleLabel[]>(`/api/workspace/${workspaceId}/labels`, {
      params: { type, ...(projectId ? { projectId } : {}) },
    }),

  create: ({
    workspaceId,
    name,
    color = DEFAULT_LABEL_COLOR,
    type = "cycle",
    projectId,
  }: {
    workspaceId: string;
    name: string;
    color?: string;
    type?: string;
    projectId?: string;
  }) =>
    apiPost<{ label?: CycleLabel; tag?: CycleLabel }>(`/api/workspace/${workspaceId}/labels`, {
      name,
      color,
      type,
      projectId,
    }),

  update: ({
    labelId,
    name,
    color,
  }: {
    labelId: string;
    name: string;
    color: string;
  }) =>
    apiPut<{ label?: CycleLabel }>(`/api/labels/${labelId}`, { name, color }),

  delete: (labelId: string) =>
    apiDelete<void>(`/api/labels/${labelId}`),
};
