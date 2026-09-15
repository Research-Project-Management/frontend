import { apiGet } from "@/shared/lib/api";

export const ExportService = {
  exportWorkItems: async (projectId: string, format: 'csv' | 'json' = 'csv') => {
    return apiGet<string | Record<string, unknown>>(
      `/api/projects/${projectId}/work-items/export?format=${format}`
    );
  },
};
