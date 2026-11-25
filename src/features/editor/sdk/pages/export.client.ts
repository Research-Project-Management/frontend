/**
 * export.client.ts
 *
 * Multi-format document export, project ZIP export/import, and template scaffold sub-API.
 */

import { apiPost, rawFetch, getAuthToken } from '@/shared/lib/api';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import type { ExportFileResult, ImportProjectZipResult } from './types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';

export const exportDocs = {
  exportDocument: async (
    docId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> => {
    return apiPost<ExportFileResult>(`${PAGES_API_BASE}/docs/${docId}/export`, {
      format,
      includeChildren,
    });
  },

  exportProjectZipUrl: (projectId: string, includeAux = false): string => {
    return `${PAGES_API_BASE}/spaces/${encodeURIComponent(projectId)}/export/zip?includeAux=${includeAux}`;
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
    const targetSpaceId = projectId || cleanPageId || '';
    const scopePrefix = `spaces/${encodeURIComponent(targetSpaceId)}`;
    const res = await rawFetch(
      `${getPagesBaseUrl()}/${scopePrefix}/export/zip${queryString}`,
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
    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(projectId)}/history/versions/${encodeURIComponent(String(version))}/export-zip${queryString}`,
      'GET',
    );
    if (!res.ok) throw new Error(`Export Version ZIP failed: ${res.statusText}`);
    return await res.blob();
  },

  importProjectZip: async (
    projectId: string,
    file: File | Blob,
    preferredRootDoc?: string,
  ): Promise<ImportProjectZipResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = preferredRootDoc ? `?preferredRootDoc=${encodeURIComponent(preferredRootDoc)}` : '';
    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${projectId}/import/zip${query}`,
      'POST',
      formData,
    );
    if (!res.ok) throw new Error(`Import ZIP failed: ${res.statusText}`);
    return (await res.json()) as ImportProjectZipResult;
  },

  scaffoldTemplate: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/templates/${templateId}/scaffold`,
      {},
    );
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
      `${getPagesBaseUrl()}/spaces/${projectId}/import/convert${query}`,
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

export const exportVersionZip = (
  projectId: string,
  version: number | string,
  projectName?: string,
  options?: { pageId?: string },
) => exportDocs.exportVersionZip(projectId, version, projectName, options);
