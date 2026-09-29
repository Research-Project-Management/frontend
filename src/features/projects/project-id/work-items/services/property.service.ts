import { apiGet, apiPatch } from "@/shared/lib/api";

export interface UserProjectProperty {
  id?: string;
  projectId: string;
  userId: string;
  filters?: Record<string, unknown>;
  displayFilters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  sortOrder?: string;
}

const getStorageKey = (projectId: string) => `flux:project-user-props:${projectId}`;

export const PropertyService = {
  getUserProperties: async (projectId: string): Promise<UserProjectProperty> => {
    if (typeof window === 'undefined') {
      return { projectId, userId: '' };
    }
    try {
      const data = localStorage.getItem(getStorageKey(projectId));
      return data ? (JSON.parse(data) as UserProjectProperty) : { projectId, userId: '' };
    } catch {
      return { projectId, userId: '' };
    }
  },

  updateUserProperties: async (
    projectId: string,
    data: {
      filters?: Record<string, unknown>;
      displayFilters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      preferences?: Record<string, unknown>;
      sortOrder?: string;
    },
  ): Promise<UserProjectProperty> => {
    if (typeof window === 'undefined') {
      return { projectId, userId: '', ...data };
    }
    try {
      const existing = await PropertyService.getUserProperties(projectId);
      const updated: UserProjectProperty = {
        ...existing,
        ...data,
        filters: { ...(existing.filters || {}), ...(data.filters || {}) },
        displayFilters: { ...(existing.displayFilters || {}), ...(data.displayFilters || {}) },
        displayProperties: { ...(existing.displayProperties || {}), ...(data.displayProperties || {}) },
        preferences: { ...(existing.preferences || {}), ...(data.preferences || {}) },
      };
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(updated));
      return updated;
    } catch {
      return { projectId, userId: '', ...data };
    }
  },
};
