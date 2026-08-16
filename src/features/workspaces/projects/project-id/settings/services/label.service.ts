import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { Label, CreateLabelInput, UpdateLabelInput, LabelType } from '../types/label.types';

// ── API Services ──────────────────────────────────────────────────────────────

export const LabelService = {
  /**
   * Fetch all labels belonging to a workspace, optionally filtered by type.
   */
  list: async (workspaceId: string, type?: LabelType): Promise<Label[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    const queryStr = params.toString() ? `?${params.toString()}` : '';

    const data = await apiGet<{ labels?: Label[] }>(
      `/api/workspace/${workspaceId}/labels${queryStr}`,
    );
    return data.labels ?? [];
  },

  /**
   * Create a new label in a workspace.
   */
  create: async (workspaceId: string, input: CreateLabelInput): Promise<Label> => {
    const data = await apiPost<{ label?: Label }>(
      `/api/workspace/${workspaceId}/labels`,
      input,
    );
    return data.label!;
  },

  /**
   * Update an existing label by ID.
   */
  update: async (labelId: string, input: UpdateLabelInput): Promise<Label> => {
    const data = await apiPut<{ label?: Label }>(
      `/api/labels/${labelId}`,
      input,
    );
    return data.label!;
  },

  /**
   * Delete a label by ID.
   */
  delete: async (labelId: string): Promise<void> => {
    await apiDelete<{ message?: string }>(`/api/labels/${labelId}`);
  },
};

// Aliases
export const fetchLabels = LabelService.list;
export const createLabel = LabelService.create;
export const updateLabel = LabelService.update;
export const deleteLabel = LabelService.delete;
