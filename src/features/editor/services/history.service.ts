/**
 * history.service.ts
 *
 * Frontend service mirroring Backend `modules/document/history/`:
 *  - Page Version Snapshots
 *  - Project History Events
 *  - Diff & Restore
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type { PageVersion, ProjectEvent } from '../types';

// ─── 1. Document Version Snapshots ───────────────────────────────────────────

export const versionService = {
  getByPageId: async (pageId: string): Promise<PageVersion[]> => {
    const res = await apiGet<{ versions: PageVersion[] }>(`/api/pages/${pageId}/versions`);
    return res.versions;
  },

  save: async ({
    pageId,
    label,
    rootPageId,
  }: {
    pageId: string;
    label?: string;
    rootPageId?: string;
  }): Promise<PageVersion> => {
    const res = await apiPost<{ version: PageVersion }>(`/api/pages/${pageId}/versions`, {
      label,
      rootPageId,
    });
    return res.version;
  },

  restore: async ({ pageId, versionId }: { pageId: string; versionId: string }): Promise<any> => {
    const res = await apiPost<{ page: any }>(
      `/api/pages/${pageId}/versions/${versionId}/restore`,
      {},
    );
    return res.page;
  },

  delete: (pageId: string, versionId: string): Promise<void> =>
    apiDelete<void>(`/api/pages/${pageId}/versions/${versionId}`),
};

export const PageVersionService = versionService;

// ─── 2. Project History Events ───────────────────────────────────────────────

export const historyService = {
  getByProjectId: async (projectId: string): Promise<ProjectEvent[]> => {
    const res = await apiGet<{ events?: ProjectEvent[]; history?: ProjectEvent[] }>(
      `/api/pages/${projectId}/history`,
    );
    return res?.events ?? res?.history ?? [];
  },

  restoreToEvent: ({ rootPageId, eventId }: { rootPageId: string; eventId: string }) =>
    apiPost<ProjectEvent[]>(`/api/pages/${rootPageId}/history/${eventId}/restore`, {}),
};

export const ProjectHistoryService = historyService;
