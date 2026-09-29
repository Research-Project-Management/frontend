import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";

export interface SavedViewRecord {
  id: string;
  name: string;
  description?: string | null;
  layout: string;
  filters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  access: 'public' | 'private';
  isFavorite?: boolean;
}

export const ViewService = {
  getViews: async (_projectId: string): Promise<SavedViewRecord[]> => [],

  createView: async (
    _projectId: string,
    data: {
      name: string;
      description?: string;
      layout?: string;
      filters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      access?: 'public' | 'private';
    },
  ): Promise<SavedViewRecord> => ({
    id: 'local-view',
    name: data.name,
    description: data.description,
    layout: data.layout || 'list',
    access: data.access || 'private',
  }),

  updateView: async (
    _projectId: string,
    viewId: string,
    data: Partial<{
      name: string;
      description?: string;
      layout?: string;
      filters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      access?: 'public' | 'private';
    }>,
  ): Promise<SavedViewRecord> => ({
    id: viewId,
    name: data.name || 'View',
    layout: data.layout || 'list',
    access: data.access || 'private',
  }),

  deleteView: async (_projectId: string, _viewId: string): Promise<{ message: string }> => ({
    message: 'ok',
  }),

  favorite: async (_projectId: string, _viewId: string): Promise<{ message: string }> => ({
    message: 'ok',
  }),

  unfavorite: async (_projectId: string, _viewId: string): Promise<{ message: string }> => ({
    message: 'ok',
  }),

  getFavoriteViews: async (_projectId: string): Promise<string[]> => [],

  getViewWorkItems: async (_projectId: string, _viewId: string): Promise<any[]> => [],
};
