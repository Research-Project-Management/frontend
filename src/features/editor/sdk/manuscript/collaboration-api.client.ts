/**
 * collaboration-api.client.ts
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
      projectId?: string;
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
    const data = await apiPost<{ suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${pageId}/suggestions`,
      body,
      idempotencyKey ? { idempotencyKey } : undefined,
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
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/accept-all`,
      {},
    );
  },

  rejectAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/reject-all`,
      {},
    );
  },

  acceptSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/accept-all`,
      { suggestionIds },
    );
  },

  rejectSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/reject-all`,
      { suggestionIds },
    );
  },
};

// ── Sub-domain: notifications.api.ts ──────────────────────────────────────

export const notifications = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    try {
      const data = await api.apiGet<{ bundles: PendingBundleInfo[] }>(
        '/api/documents/notifications/bundles',
      );
      return data.bundles || [];
    } catch {
      return [];
    }
  },

  flushBundle: async (
    scopeId?: string,
    projectId?: string,
  ): Promise<NotificationDigest | null> => {
    try {
      const data = await api.apiPost<{ digest: NotificationDigest }>(
        '/api/documents/notifications/bundles/flush',
        { scopeId, projectId },
      );
      return data.digest || null;
    } catch {
      return null;
    }
  },

  getDigestHistory: async (limit = 20): Promise<NotificationDigest[]> => {
    try {
      const data = await api.apiGet<{ digests: NotificationDigest[] }>(
        '/api/documents/notifications/digests',
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
        '/api/documents/notifications/settings',
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
        '/api/documents/notifications/settings',
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
    return apiPost<SearchResultResponse>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/search`,
      {
        query,
        ...options,
      },
    );
  },

  batchReplace: async (
    projectId: string,
    query: string,
    replaceWith: string,
    options: BatchReplaceOptions = {},
  ): Promise<BatchReplaceResultResponse> => {
    return apiPost<BatchReplaceResultResponse>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/replace`,
      {
        query,
        replaceWith,
        ...options,
      },
    );
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
    return `${MANUSCRIPTS_API_BASE}/projects/${projectId}/export/zip${tokenQuery}`;
  },

  exportProjectZip: async (
    projectId: string,
    options: { includeAux?: boolean; includePdf?: boolean; cleanArxiv?: boolean; projectName?: string } = {},
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (options.includeAux) params.append('includeAux', 'true');
    if (options.includePdf) params.append('includePdf', 'true');
    if (options.cleanArxiv) params.append('cleanArxiv', 'true');
    if (options.projectName) params.append('projectName', options.projectName);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/projects/${projectId}/export/zip${queryString}`,
      'GET',
    );
    if (!res.ok) throw new Error(`Export ZIP failed: ${res.statusText}`);
    return await res.blob();
  },

  importProjectZip: async (projectId: string, file: File | Blob, preferredRootDoc?: string): Promise<ImportProjectZipResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = preferredRootDoc ? `?preferredRootDoc=${encodeURIComponent(preferredRootDoc)}` : '';
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/projects/${projectId}/import/zip${query}`,
      'POST',
      formData,
    );
    if (!res.ok) throw new Error(`Import ZIP failed: ${res.statusText}`);
    return (await res.json()) as ImportProjectZipResult;
  },

  scaffoldTemplate: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`, {});
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
      `${getManuscriptsBaseUrl()}/projects/${projectId}/import/convert${query}`,
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
      const res = await apiGet<ProjectVersionListItem[]>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions`,
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
            id: s.author?.id || s.createdBy?.id || s.createdById || 'user-1',
            name: s.author?.name || s.createdBy?.name || (s.createdById ? 'Collaborator' : 'You'),
          },
          sizeBytes: s.sizeBytes ?? 0,
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
  ): Promise<VersionLabelItem | null> => {
    return apiPost<VersionLabelItem>(
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
  ): Promise<ProjectSnapshotDetail> => {
    return apiPost<ProjectSnapshotDetail>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/snapshots`,
      dto,
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
