import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { PageVersion } from "../types/document.types";

export const PageVersionService = {
  getByPageId: async (pageId: string) => {
    const res = await apiGet<{ versions: PageVersion[] }>(`/api/pages/${pageId}/versions`);
    return res.versions;
  },

  save: async ({ pageId, label, rootPageId }: { pageId: string; label?: string; rootPageId?: string }) => {
    const res = await apiPost<{ version: PageVersion }>(`/api/pages/${pageId}/versions`, { label, rootPageId });
    return res.version;
  },

  restore: async ({ pageId, versionId }: { pageId: string; versionId: string }) => {
    const res = await apiPost<{ page: any }>(`/api/pages/${pageId}/versions/${versionId}/restore`, {});
    return res.page;
  },

  delete: ({ pageId, versionId }: { pageId: string; versionId: string }) =>
    apiDelete<void>(`/api/pages/${pageId}/versions/${versionId}`),
};
