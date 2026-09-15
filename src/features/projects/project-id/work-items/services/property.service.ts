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

export const PropertyService = {
  getUserProperties: (projectId: string) =>
    apiGet<UserProjectProperty>(`/api/projects/${projectId}/user-properties`),

  updateUserProperties: (
    projectId: string,
    data: {
      filters?: Record<string, unknown>;
      displayFilters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      preferences?: Record<string, unknown>;
      sortOrder?: string;
    },
  ) =>
    apiPatch<UserProjectProperty>(`/api/projects/${projectId}/user-properties`, data),
};
