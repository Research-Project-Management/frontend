/**
 * history.client.ts
 * Canonical History SDK client targeting `api/v1/pages/spaces/:spaceId/history`.
 */

import { apiGet, apiPost, apiDelete, rawFetch } from '@/shared/lib/api';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  VersionLabelItem,
  RestoreProjectVersionFileResult,
} from './types';

export const historyKeys = {
  all: ['history'] as const,
  versions: (spaceId: string, pageId?: string) =>
    pageId
      ? (['history', 'space', spaceId, 'page', pageId, 'versions'] as const)
      : (['history', 'space', spaceId, 'versions'] as const),
  snapshot: (spaceId: string, version: number) =>
    ['history', 'snapshot', spaceId, version] as const,
};

function buildHistoryUrl(spaceId: string, suffix: string, pageId?: string): string {
  const base = `${PAGES_API_BASE}/spaces/${encodeURIComponent(spaceId)}/history${suffix}`;
  const cleanPageId = pageId?.trim();
  if (!cleanPageId) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}pageId=${encodeURIComponent(cleanPageId)}`;
}

export const history = {
  getProjectVersions: async (
    spaceId: string,
    options?: { pageId?: string },
  ): Promise<ProjectVersionListItem[]> => {
    try {
      const res = await apiGet<ProjectVersionListItem[]>(
        buildHistoryUrl(spaceId, '/versions', options?.pageId),
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  getProjectSnapshot: async (
    spaceId: string,
    version: number,
    options?: { pageId?: string },
  ): Promise<ProjectSnapshotDetail | null> => {
    try {
      return await apiGet<ProjectSnapshotDetail>(
        buildHistoryUrl(spaceId, `/versions/${version}`, options?.pageId),
      );
    } catch {
      return null;
    }
  },

  compareProjectVersions: async (
    spaceId: string,
    baseVersion: number,
    targetVersion: number,
    options?: { pageId?: string },
  ): Promise<ProjectDiffResponse | null> => {
    try {
      return await apiGet<ProjectDiffResponse>(
        buildHistoryUrl(
          spaceId,
          `/diff?baseVersion=${baseVersion}&targetVersion=${targetVersion}`,
          options?.pageId,
        ),
      );
    } catch {
      return null;
    }
  },

  createProjectSnapshot: async (
    spaceId: string,
    dto: { summary?: string; label?: string; isAutomatic?: boolean; pageId?: string },
    options?: { pageId?: string },
  ): Promise<ProjectSnapshotDetail> => {
    const cleanPageId = options?.pageId?.trim() || dto.pageId?.trim();
    return apiPost<ProjectSnapshotDetail>(
      buildHistoryUrl(spaceId, '/snapshots', cleanPageId),
      { ...dto, ...(cleanPageId ? { pageId: cleanPageId } : {}) },
    );
  },

  labelProjectVersion: async (
    spaceId: string,
    version: number,
    label: string,
    options?: { pageId?: string },
  ): Promise<VersionLabelItem | null> => {
    const cleanPageId = options?.pageId?.trim();
    return apiPost<VersionLabelItem>(
      buildHistoryUrl(spaceId, `/versions/${version}/labels`, cleanPageId),
      { label, ...(cleanPageId ? { pageId: cleanPageId } : {}) },
    );
  },

  deleteProjectLabel: async (
    spaceId: string,
    labelId: string,
    options?: { pageId?: string },
  ): Promise<void> => {
    await apiDelete(
      buildHistoryUrl(spaceId, `/labels/${labelId}`, options?.pageId),
    );
  },

  restoreProjectVersion: async (
    spaceId: string,
    targetVersion: number,
    options?: { pageId?: string },
  ): Promise<{
    restoredSnapshot: ProjectSnapshotDetail;
    newSnapshot: ProjectSnapshotDetail;
    restoreResult: { restoredFilesCount: number; restoredDocIds: string[] };
  }> => {
    const cleanPageId = options?.pageId?.trim();
    return apiPost(
      buildHistoryUrl(spaceId, '/restore', cleanPageId),
      { targetVersion, ...(cleanPageId ? { pageId: cleanPageId } : {}) },
    );
  },

  restoreProjectVersionFile: async (
    spaceId: string,
    version: number,
    pathname: string,
    fileId?: string,
    options?: { pageId?: string },
  ): Promise<RestoreProjectVersionFileResult> => {
    const cleanPageId = options?.pageId?.trim();
    return apiPost<RestoreProjectVersionFileResult>(
      buildHistoryUrl(spaceId, `/versions/${version}/restore-file`, cleanPageId),
      {
        pathname,
        ...(fileId ? { fileId } : {}),
        ...(cleanPageId ? { pageId: cleanPageId } : {}),
      },
    );
  },

  exportVersionZip: async (
    spaceId: string,
    version: number | string,
    projectName?: string,
    options?: { pageId?: string },
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (projectName) params.set('projectName', projectName);
    const cleanPageId = options?.pageId?.trim();
    if (cleanPageId) params.set('pageId', cleanPageId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(spaceId)}/history/versions/${encodeURIComponent(String(version))}/export-zip${qs}`,
      'GET',
    );
    if (!res.ok) {
      throw new Error(`Export Version ZIP failed: ${res.statusText}`);
    }
    return res.blob();
  },

  listLabels: async (
    spaceId: string,
    options?: { pageId?: string },
  ): Promise<VersionLabelItem[]> => {
    try {
      const res = await apiGet<VersionLabelItem[]>(
        buildHistoryUrl(spaceId, '/labels', options?.pageId),
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  getBlob: async (
    spaceId: string,
    contentHash: string,
  ): Promise<{
    contentHash: string;
    content: string | null;
    sizeBytes: number;
    inStorage: boolean;
    storageKey: string | null;
  } | null> => {
    try {
      return await apiGet(
        buildHistoryUrl(spaceId, `/blobs/${encodeURIComponent(contentHash)}`),
      );
    } catch {
      return null;
    }
  },

  flushHistory: async (
    spaceId: string,
    options?: { pageId?: string },
  ): Promise<{ flushed: boolean; snapshot: ProjectSnapshotDetail | null }> => {
    return apiPost(buildHistoryUrl(spaceId, '/flush', options?.pageId), {});
  },
};

export const restoreProjectVersionFile = (
  spaceId: string,
  version: number,
  pathname: string,
  fileId?: string,
  options?: { pageId?: string },
) => history.restoreProjectVersionFile(spaceId, version, pathname, fileId, options);
