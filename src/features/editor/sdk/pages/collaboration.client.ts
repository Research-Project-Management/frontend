/**
 * collaboration.client.ts
 *
 * Collaboration, Review, History, Search, and Export Sub-APIs (Part of manuscriptService SDK).
 */

import * as api from '@/shared/lib/api';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  rawFetch,
  getAuthToken,
} from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import { getCachedUser } from '@/features/auth/services/auth.service';
import type {
  ExportFileResult,
  CreateSuggestionPayload,
  SearchOptions,
  SearchResultResponse,
  BatchReplaceOptions,
  BatchReplaceResultResponse,
  VersionDiffResponse,
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  VersionLabelItem,
  ImportProjectZipResult,
  RestoreProjectVersionFileResult,
  ReconstructedContent,
} from './types';
import type { Page } from '@/features/editor/domain/types/core.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';
import type { PageVersion, ProjectEvent } from '@/features/editor/domain/types/history.types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';
import type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
} from '@/features/editor/domain/collaboration/notification-digest';

export type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
};

// ── Sub-domain: comments.api.ts ──────────────────────────────────────

export const comments = {
  getComments: async (docId: string, status?: string): Promise<PageComment[]> => {
    if (!docId) return [];
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await apiGet<{ comments: PageComment[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments${query}`,
        { silent: true },
      );
      return data.comments || [];
    } catch {
      return [];
    }
  },

  createComment: async (
    docId: string,
    payload: {
      content: string;
      line?: number;
      lineEnd?: number;
      spaceId?: string;
    },
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments`,
      payload,
    );
    return data.comment;
  },

  updateComment: async (
    docId: string,
    commentId: string,
    payload: { content?: string; status?: 'open' | 'resolved' } | string,
  ): Promise<PageComment> => {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    const data = await apiPatch<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}`,
      body,
    );
    return data.comment;
  },

  deleteComment: async (docId: string, commentId: string): Promise<void> => {
    await apiDelete(`${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}`);
  },

  deleteReply: async (
    docId: string,
    commentId: string,
    replyId: string,
  ): Promise<PageComment> => {
    const data = await apiDelete<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}/replies/${replyId}`,
    );
    return data.comment;
  },

  addReply: async (
    docId: string,
    commentId: string,
    content: string,
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}/reply`,
      { content },
    );
    return data.comment;
  },

  resolveComment: async (
    docId: string,
    commentId: string,
    resolved: boolean,
  ): Promise<PageComment> => {
    const data = await apiPatch<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}/resolve`,
      { resolved },
    );
    return data.comment;
  },
};

// ── Sub-domain: suggestions.api.ts ──────────────────────────────────────

export const suggestions = {
  getSuggestions: async (
    docId: string,
    status?: SuggestionStatus,
  ): Promise<PageSuggestion[]> => {
    if (!docId) return [];
    try {
      const queryStr = status ? `?status=${status}` : '';
      const data = await apiGet<{ suggestions: PageSuggestion[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions${queryStr}`,
        { silent: true },
      );
      return data.suggestions || [];
    } catch {
      return [];
    }
  },

  createSuggestion: async (payload: CreateSuggestionPayload): Promise<PageSuggestion> => {
    const { pageId, idempotencyKey, ...body } = payload;
    const data = idempotencyKey
      ? await apiPost<{ suggestion: PageSuggestion }>(
          `${MANUSCRIPTS_API_BASE}/docs/${pageId}/suggestions`,
          body,
          { idempotencyKey },
        )
      : await apiPost<{ suggestion: PageSuggestion }>(
          `${MANUSCRIPTS_API_BASE}/docs/${pageId}/suggestions`,
          body,
        );
    return data.suggestion;
  },

  acceptSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion; page: Page }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion; page: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/accept`,
      {},
    );
  },

  rejectSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/reject`,
      {},
    );
  },

  acceptAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'accept' },
    );
  },

  rejectAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'reject' },
    );
  },

  acceptSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'accept', suggestionIds },
    );
  },

  rejectSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'reject', suggestionIds },
    );
  },

  batchResolve: async (
    docId: string,
    payload: { action: 'accept' | 'reject'; suggestionIds?: string[] },
  ): Promise<{
    ok: boolean;
    action: 'accept' | 'reject';
    resolvedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    page?: Page;
  }> => {
    return await apiPost(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      payload,
    );
  },
};

// ── Sub-domain: notifications.api.ts ──────────────────────────────────────

export const notifications = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    try {
      const data = await api.apiGet<{ bundles: PendingBundleInfo[] }>(
        `${MANUSCRIPTS_API_BASE}/notifications/bundles`,
      );
      return data.bundles || [];
    } catch {
      return [];
    }
  },

  flushBundle: async (
    scopeId?: string,
    spaceId?: string,
    pageId?: string,
  ): Promise<NotificationDigest | null> => {
    const payload: { scopeId?: string; spaceId?: string; pageId?: string } = {};
    if (scopeId) payload.scopeId = scopeId;
    if (spaceId) payload.spaceId = spaceId;
    if (pageId) payload.pageId = pageId;

    const data = await api.apiPost<{ digest?: NotificationDigest | null }>(
      `${MANUSCRIPTS_API_BASE}/notifications/bundles/flush`,
      payload,
    );
    return data?.digest || null;
  },

  getDigestHistory: async (limit = 20): Promise<NotificationDigest[]> => {
    try {
      const data = await api.apiGet<{ digests: NotificationDigest[] }>(
        `${MANUSCRIPTS_API_BASE}/notifications/digests`,
        { params: { limit } },
      );
      return data.digests || [];
    } catch {
      return [];
    }
  },

  getSettings: async (): Promise<NotificationBundlingSettings> => {
    try {
      const data = await api.apiGet<{ settings: NotificationBundlingSettings }>(
        `${MANUSCRIPTS_API_BASE}/notifications/settings`,
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },

  updateSettings: async (
    settings: Partial<NotificationBundlingSettings>,
  ): Promise<NotificationBundlingSettings> => {
    try {
      const data = await api.apiPut<{ settings: NotificationBundlingSettings }>(
        `${MANUSCRIPTS_API_BASE}/notifications/settings`,
        settings,
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },
};

export const notificationBundlerService = notifications;

// ── Sub-domain: search.api.ts ──────────────────────────────────────

export const search = {
  search: async (
    projectId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultResponse> => {
    const cleanPageId = options.pageId?.trim();
    const endpoint =
      !projectId && cleanPageId
        ? `${MANUSCRIPTS_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/search`
        : `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/search`;
    return apiPost<SearchResultResponse>(endpoint, {
      query,
      ...options,
    });
  },

  batchReplace: async (
    projectId: string,
    query: string,
    replaceWith: string,
    options: BatchReplaceOptions = {},
  ): Promise<BatchReplaceResultResponse> => {
    const cleanPageId = options.pageId?.trim();
    const endpoint =
      !projectId && cleanPageId
        ? `${MANUSCRIPTS_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/replace`
        : `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/replace`;
    return apiPost<BatchReplaceResultResponse>(endpoint, {
      query,
      replaceWith,
      ...options,
    });
  },
};

// ── Sub-domain: export.api.ts ──────────────────────────────────────

export const exportDocs = {
  exportDocument: async (
    docId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> => {
    return apiPost<ExportFileResult>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/export`, {
      format,
      includeChildren,
    });
  },

  exportProjectZipUrl: (projectId: string, includeAux = false): string => {
    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}&includeAux=${includeAux}` : `?includeAux=${includeAux}`;
    return `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/export/zip${tokenQuery}`;
  },

  exportProjectZip: async (
    projectId: string,
    options: { includeAux?: boolean; includePdf?: boolean; cleanArxiv?: boolean; projectName?: string; pageId?: string } = {},
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (options.includeAux) params.append('includeAux', 'true');
    if (options.includePdf) params.append('includePdf', 'true');
    if (options.cleanArxiv) params.append('cleanArxiv', 'true');
    if (options.projectName) params.append('projectName', options.projectName);
    const cleanPageId = options.pageId?.trim();
    if (cleanPageId) params.append('pageId', cleanPageId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const targetScopeId = projectId || cleanPageId || '';
    const scopePrefix = `spaces/${encodeURIComponent(targetScopeId)}`;
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/${scopePrefix}/export/zip${queryString}`,
      'GET',
    );
    if (!res.ok) throw new Error(`Export ZIP failed: ${res.statusText}`);
    return await res.blob();
  },

  exportVersionZip: async (
    projectId: string,
    version: number | string,
    projectName?: string,
    options?: { pageId?: string },
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (projectName) params.append('projectName', projectName);
    const cleanPageId = options?.pageId?.trim();
    if (cleanPageId) params.append('pageId', cleanPageId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const scopePrefix =
      !projectId && cleanPageId ? `pages/${encodeURIComponent(cleanPageId)}` : `spaces/${projectId}`;
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/${scopePrefix}/history/versions/${encodeURIComponent(String(version))}/export-zip${queryString}`,
      'GET',
    );
    if (!res.ok) throw new Error(`Export Version ZIP failed: ${res.statusText}`);
    return await res.blob();
  },

  importProjectZip: async (projectId: string, file: File | Blob, preferredRootDoc?: string): Promise<ImportProjectZipResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = preferredRootDoc ? `?preferredRootDoc=${encodeURIComponent(preferredRootDoc)}` : '';
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/spaces/${projectId}/import/zip${query}`,
      'POST',
      formData,
    );
    if (!res.ok) throw new Error(`Import ZIP failed: ${res.statusText}`);
    return (await res.json()) as ImportProjectZipResult;
  },

  scaffoldTemplate: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/spaces/${projectId}/templates/${templateId}/scaffold`, {});
  },

  convertDocument: async (
    projectId: string,
    file: File | Blob,
    format?: 'docx' | 'md',
  ): Promise<Record<string, unknown>> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = format ? `?format=${encodeURIComponent(format)}` : '';
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/spaces/${projectId}/import/convert${query}`,
      'POST',
      formData,
    );
    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errJson?.message || `Document conversion failed: ${res.statusText}`);
    }
    return (await res.json()) as Record<string, unknown>;
  },
};

// ── Sub-domain: history.api.ts ──────────────────────────────────────

function buildHistoryUrl(projectId: string, suffix: string, pageId?: string): string {
  const cleanPageId = pageId?.trim();
  if (!projectId && cleanPageId) {
    return `${MANUSCRIPTS_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/history${suffix}`;
  }
  const base = `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/history${suffix}`;
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
      return await apiGet<ReconstructedContent>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/at${query}`);
    } catch {
      return { content: '', timestamp: Date.now() };
    }
  },
};
