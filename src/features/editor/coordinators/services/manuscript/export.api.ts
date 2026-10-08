/**
 * export.api.ts
 *
 * Multi-format export/import sub-API: PDF, ZIP packages, format conversion, template scaffolding.
 */

import { apiPost, getAuthToken } from '@/shared/lib/api';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import type { ExportFileResult } from './types';

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
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (options.includeAux) params.append('includeAux', 'true');
    if (options.includePdf) params.append('includePdf', 'true');
    if (options.cleanArxiv) params.append('cleanArxiv', 'true');
    if (options.projectName) params.append('projectName', options.projectName);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/export/zip${queryString}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    if (!res.ok) throw new Error(`Export ZIP failed: ${res.statusText}`);
    return await res.blob();
  },

  importProjectZip: async (projectId: string, file: File | Blob, preferredRootDoc?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = preferredRootDoc ? `?preferredRootDoc=${encodeURIComponent(preferredRootDoc)}` : '';
    const token = getAuthToken();
    const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/import/zip${query}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`Import ZIP failed: ${res.statusText}`);
    return await res.json();
  },

  scaffoldTemplate: async (projectId: string, templateId: string): Promise<any> => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`, {});
  },

  convertDocument: async (
    projectId: string,
    file: File | Blob,
    format?: 'docx' | 'md',
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = format ? `?format=${encodeURIComponent(format)}` : '';
    const token = getAuthToken();
    const res = await fetch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/import/convert${query}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errJson?.message || `Document conversion failed: ${res.statusText}`);
    }
    return await res.json();
  },
};
