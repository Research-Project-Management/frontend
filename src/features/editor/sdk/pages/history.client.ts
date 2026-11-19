/**
 * history.client.ts
 *
 * Document and project version history, snapshots, diffing, labels, and restore sub-API.
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import { exportDocs } from './export.client';
import { getCachedUser } from '@/features/auth/services/auth.service';
import type {
  VersionDiffResponse,
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  VersionLabelItem,
  RestoreProjectVersionFileResult,
  ReconstructedContent,
} from './types';
import type { PageVersion, ProjectEvent } from '@/features/editor/domain/types/history.types';

export const historyKeys = {
  all: ['history'] as const,
  project: (projectId: string) => ['history', 'project', projectId] as const,
  versions: (projectId: string, pageId?: string) =>
    pageId
      ? (['history', 'project', projectId, 'page', pageId, 'versions'] as const)
      : (['history', 'project', projectId, 'versions'] as const),
  snapshot: (projectId: string, version: number) => ['history', 'snapshot', projectId, version] as const,
  doc: (docId: string) => ['history', 'doc', docId] as const,
  diff: (docId: string, from: string, to: string) => ['history', 'diff', docId, from, to] as const,
};

function buildHistoryUrl(projectId: string, suffix: string, pageId?: string): string {
  const cleanPageId = pageId?.trim();
  if (!projectId && cleanPageId) {
    return `${PAGES_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/history${suffix}`;
  }
  const base = `${PAGES_API_BASE}/spaces/${projectId}/history${suffix}`;
  if (!cleanPageId) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}pageId=${encodeURIComponent(cleanPageId)}`;
}

export const history = {
  getByPageId: async (docId: string): Promise<PageVersion[]> => {
    return history.getByDocId(docId);
  },

  getByDocId: async (docId: string): Promise<PageVersion[]> => {
    if (!docId) return [];
    try {
      const res = await apiGet<{ versions: PageVersion[] }>(
        `${PAGES_API_BASE}/docs/${docId}/versions`,
        { silent: true },
      );
      return res.versions || [];
    } catch {
      return [];
    }
  },

  getById: async (docId: string, versionId: string): Promise<PageVersion | null> => {
    try {
      const res = await apiGet<{ version: PageVersion }>(`${PAGES_API_BASE}/docs/${docId}/versions/${versionId}`);
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
      `${PAGES_API_BASE}/docs/${payload.pageId}/versions`,
      payload,
    );
    return res.version;
  },

  restore: async (payload: { pageId: string; versionId: string }): Promise<void> => {
    await apiPost(`${PAGES_API_BASE}/docs/${payload.pageId}/versions/${payload.versionId}/restore`, {});
  },

  updateLabel: async (
    docId: string,
    versionId: string,
    label: string,
    title?: string,
  ): Promise<PageVersion> => {
    const res = await apiPost<{ version: PageVersion }>(
      `${PAGES_API_BASE}/docs/${docId}/versions/${versionId}/label`,
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
        `${PAGES_API_BASE}/docs/${docId}/versions/diff?from=${fromVersionId}&to=${toVersionId}`,
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

  getByProjectId: async (
    projectId: string,
    options?: { pageId?: string },
  ): Promise<ProjectEvent[]> => {
    try {
      const res = await apiGet<ProjectVersionListItem[]>(
        buildHistoryUrl(projectId, '/versions', options?.pageId),
      );
      if (Array.isArray(res) && res.length > 0) {
        return res.map((s) => ({
          id: s.id,
          versionNumber: s.version,
          title: s.summary || `Version ${s.version}`,
          label: s.labels?.[0]?.label || s.label || s.summary || '',
          fileName: s.fileName || s.label || 'Project Snapshot',
          createdAt: s.createdAt,
          savedBy: {
            id: s.author?.id || s.createdBy?.id || s.createdById || getCachedUser()?.id || 'current-user',
            name: s.author?.name || s.createdBy?.name || (s.createdById ? 'Collaborator' : 'You'),
          },
          sizeBytes: s.sizeBytes ?? 0,
          eventType: s.isAutomatic ? 'auto_save' : 'manual_save',
          page: projectId || options?.pageId || '',
        }));
      }
      return [];
    } catch {
      return [];
    }
  },

  getProjectVersions: async (
    projectId: string,
    options?: { pageId?: string },
  ): Promise<ProjectVersionListItem[]> => {
    try {
      const res = await apiGet<ProjectVersionListItem[]>(
        buildHistoryUrl(projectId, '/versions', options?.pageId),
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  getProjectSnapshot: async (
    projectId: string,
    version: number,
    options?: { pageId?: string },
  ): Promise<ProjectSnapshotDetail | null> => {
    try {
      return await apiGet<ProjectSnapshotDetail>(
        buildHistoryUrl(projectId, `/versions/${version}`, options?.pageId),
      );
    } catch {
      return null;
    }
  },

  compareProjectVersions: async (
    projectId: string,
    baseVersion: number,
    targetVersion: number,
    options?: { pageId?: string },
  ): Promise<ProjectDiffResponse | null> => {
    try {
      return await apiGet<ProjectDiffResponse>(
        buildHistoryUrl(
          projectId,
          `/diff?baseVersion=${baseVersion}&targetVersion=${targetVersion}`,
          options?.pageId,
        ),
      );
    } catch {
      return null;
    }
  },

  labelProjectVersion: async (
    projectId: string,
    version: number,
    label: string,
    options?: { pageId?: string },
  ): Promise<VersionLabelItem | null> => {
    const cleanPageId = options?.pageId?.trim();
    return apiPost<VersionLabelItem>(
      buildHistoryUrl(projectId, `/versions/${version}/labels`, cleanPageId),
      { label, ...(cleanPageId ? { pageId: cleanPageId } : {}) },
    );
  },

  deleteProjectLabel: async (
    projectId: string,
    labelId: string,
    options?: { pageId?: string },
  ): Promise<void> => {
    await apiDelete(
      buildHistoryUrl(projectId, `/labels/${labelId}`, options?.pageId),
    );
  },

  restoreProjectVersion: async (
    projectId: string,
    targetVersion: number,
    options?: { pageId?: string },
  ): Promise<{
    restoredSnapshot: ProjectSnapshotDetail;
    newSnapshot: ProjectSnapshotDetail;
    restoreResult: { restoredFilesCount: number; restoredDocIds: string[] };
  }> => {
    const cleanPageId = options?.pageId?.trim();
    return apiPost(
      buildHistoryUrl(projectId, '/restore', cleanPageId),
      { targetVersion, ...(cleanPageId ? { pageId: cleanPageId } : {}) },
    );
  },

  restoreProjectVersionFile: async (
    projectId: string,
    version: number,
    pathname: string,
    fileId?: string,
    options?: { pageId?: string },
  ): Promise<RestoreProjectVersionFileResult> => {
    const cleanPageId = options?.pageId?.trim();
    return apiPost<RestoreProjectVersionFileResult>(
      buildHistoryUrl(projectId, `/versions/${version}/restore-file`, cleanPageId),
      {
        pathname,
        ...(fileId ? { fileId } : {}),
        ...(cleanPageId ? { pageId: cleanPageId } : {}),
      },
    );
  },

  exportVersionZip: async (
    projectId: string,
    version: number | string,
    projectName?: string,
    options?: { pageId?: string },
  ): Promise<Blob> => {
    return exportDocs.exportVersionZip(projectId, version, projectName, options);
  },

  createProjectSnapshot: async (
    projectId: string,
    dto: { summary?: string; label?: string; isAutomatic?: boolean; pageId?: string },
    options?: { pageId?: string },
  ): Promise<ProjectSnapshotDetail> => {
    const cleanPageId = options?.pageId?.trim() || dto.pageId?.trim();
    return apiPost<ProjectSnapshotDetail>(
      buildHistoryUrl(projectId, '/snapshots', cleanPageId),
      { ...dto, ...(cleanPageId ? { pageId: cleanPageId } : {}) },
    );
  },

  getContentAt: async (
    docId: string,
    t: string | number,
  ): Promise<ReconstructedContent> => {
    try {
      const query = t !== undefined && t !== null ? `?timestamp=${encodeURIComponent(String(t))}` : '';
      return await apiGet<ReconstructedContent>(`${PAGES_API_BASE}/docs/${docId}/at${query}`);
    } catch {
      return { content: '', timestamp: Date.now() };
    }
  },
};

export const restoreProjectVersionFile = (
  projectId: string,
  version: number,
  pathname: string,
  fileId?: string,
  options?: { pageId?: string },
) => history.restoreProjectVersionFile(projectId, version, pathname, fileId, options);
