/**
 * history.api.ts
 *
 * History, snapshot revisions, diffing, and audit log sub-API.
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type { PageVersion, ProjectEvent } from '@/features/editor/domain/types';
import { MANUSCRIPTS_API_BASE } from './base';
import type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  VersionDiffResponse,
  OpLogTimeline,
  ReconstructedContent,
} from './types';

export const history = {
  getByDocId: async (docId: string): Promise<PageVersion[]> => {
    if (!docId) return [];
    try {
      const res = await apiGet<{ versions: PageVersion[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/versions`,
        { silent: true },
      );
      return res.versions || [];
    } catch {
      return [];
    }
  },

  getById: async (docId: string, versionId: string): Promise<PageVersion | null> => {
    try {
      const res = await apiGet<{ version: PageVersion }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/versions/${versionId}`);
      return res.version || null;
    } catch {
      return null;
    }
  },

  save: async (payload: {
    pageId: string;
    label?: string;
    content?: string;
    eventType?: string;
    fileName?: string;
    rootPageId?: string;
  }): Promise<PageVersion> => {
    const res = await apiPost<{ version: PageVersion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${payload.pageId}/versions`,
      payload,
    );
    return res.version;
  },

  restore: async (payload: { pageId: string; versionId: string }): Promise<void> => {
    await apiPost(`${MANUSCRIPTS_API_BASE}/docs/${payload.pageId}/versions/${payload.versionId}/restore`, {});
  },

  updateLabel: async (
    docId: string,
    versionId: string,
    label: string,
    title?: string,
  ): Promise<PageVersion> => {
    const res = await apiPost<{ version: PageVersion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/versions/${versionId}/label`,
      { label, title },
    );
    return res.version;
  },

  getDiff: async (
    docId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<VersionDiffResponse> => {
    try {
      return await apiGet<VersionDiffResponse>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/versions/diff?from=${fromVersionId}&to=${toVersionId}`,
      );
    } catch {
      return {
        fromVersionId,
        toVersionId,
        fromContent: '',
        toContent: '',
        diff: '',
        chunks: [],
        stats: { additions: 0, deletions: 0, addedLines: 0, deletedLines: 0, unchangedLines: 0 },
      };
    }
  },

  compareVersions: async (
    docId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<VersionDiffResponse> => {
    return history.getDiff(docId, fromVersionId, toVersionId);
  },

  getByProjectId: async (projectId: string): Promise<ProjectEvent[]> => {
    try {
      const res = await apiGet<any[]>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions`,
      );
      if (Array.isArray(res) && res.length > 0) {
        return res.map((s) => ({
          id: s.id,
          versionNumber: s.version,
          title: s.summary || `Version ${s.version}`,
          label: s.labels?.[0]?.label || s.summary || '',
          fileName: 'Project Snapshot',
          createdAt: s.createdAt,
          savedBy: { id: s.createdById || 'user-1', name: s.createdById ? 'Collaborator' : 'You' },
          eventType: s.isAutomatic ? 'auto_save' : 'manual_save',
          page: projectId,
        }));
      }
      return [];
    } catch {
      return [];
    }
  },

  getProjectVersions: async (projectId: string): Promise<ProjectVersionListItem[]> => {
    try {
      const res = await apiGet<ProjectVersionListItem[]>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions`,
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  getProjectSnapshot: async (
    projectId: string,
    version: number,
  ): Promise<ProjectSnapshotDetail | null> => {
    try {
      return await apiGet<ProjectSnapshotDetail>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions/${version}`,
      );
    } catch {
      return null;
    }
  },

  compareProjectVersions: async (
    projectId: string,
    baseVersion: number,
    targetVersion: number,
  ): Promise<ProjectDiffResponse | null> => {
    try {
      return await apiGet<ProjectDiffResponse>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/diff?baseVersion=${baseVersion}&targetVersion=${targetVersion}`,
      );
    } catch {
      return null;
    }
  },

  labelProjectVersion: async (
    projectId: string,
    version: number,
    label: string,
  ): Promise<any | null> => {
    return apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions/${version}/labels`,
      { label },
    );
  },

  deleteProjectLabel: async (projectId: string, labelId: string): Promise<void> => {
    await apiDelete(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/labels/${labelId}`,
    );
  },

  restoreProjectVersion: async (
    projectId: string,
    targetVersion: number,
  ): Promise<{
    restoredSnapshot: ProjectSnapshotDetail;
    newSnapshot: ProjectSnapshotDetail;
    restoreResult: { restoredFilesCount: number; restoredDocIds: string[] };
  }> => {
    return apiPost(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/restore`,
      { targetVersion },
    );
  },

  createProjectSnapshot: async (
    projectId: string,
    dto: { summary?: string; label?: string; isAutomatic?: boolean },
  ): Promise<any | null> => {
    return apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/snapshots`,
      dto,
    );
  },

  getTimeline: async (
    docId: string,
    _from?: string | number,
    _to?: string | number,
  ): Promise<OpLogTimeline> => {
    try {
      return await apiGet<OpLogTimeline>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/timeline`);
    } catch {
      return { entries: [], oldestMs: Date.now() - 3600000, newestMs: Date.now() };
    }
  },

  getContentAt: async (
    docId: string,
    _t: string | number,
  ): Promise<ReconstructedContent> => {
    try {
      return await apiGet<ReconstructedContent>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/at`);
    } catch {
      return { content: '', timestamp: Date.now() };
    }
  },
};
