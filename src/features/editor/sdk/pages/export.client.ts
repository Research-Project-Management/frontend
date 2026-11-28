/**
 * export.client.ts
 *
 * Canonical 1:1 HTTP client for Backend `ExportImportController` (`api/v1/pages`).
 */

import { apiPost, rawFetch } from '@/shared/lib/api';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import type {
  DocumentExportFormat,
  ExportFileResult,
  ExportZipQuery,
  ImportFromUrlInput,
  ImportFromUrlResult,
  ImportZipResult,
} from './types';

function buildQuery(
  entries: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    const str = typeof value === 'boolean' ? String(value) : String(value).trim();
    if (str) params.set(key, str);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function toFileFormData(file: File | Blob): FormData {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

async function parseErrorMessage(res: Response, fallbackPrefix: string): Promise<string> {
  const errBody = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (errBody?.message) {
    return Array.isArray(errBody.message) ? errBody.message.join(', ') : errBody.message;
  }
  return `${fallbackPrefix}: ${res.statusText || `HTTP ${res.status}`}`;
}

export const exportDocs = {
  exportZip: async (
    spaceId: string,
    query: ExportZipQuery = {},
  ): Promise<Blob> => {
    const cleanPageId = query.pageId?.trim();
    const targetSpaceId = spaceId || cleanPageId || '';
    const qs = buildQuery({
      includePdf: query.includePdf,
      cleanArxiv: query.cleanArxiv,
      mode: query.mode,
      version: query.version,
      projectName: query.projectName,
      pageId: cleanPageId,
    });
    const url = `${getPagesBaseUrl()}/spaces/${encodeURIComponent(targetSpaceId)}/export/zip${qs}`;

    const res = await rawFetch(url, 'GET');
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Export ZIP failed'));
    }
    return res.blob();
  },

  importZip: async (
    spaceId: string,
    file: File | Blob,
    options?: { preferredRootDoc?: string; pageId?: string },
  ): Promise<ImportZipResult> => {
    const qs = buildQuery({
      preferredRootDoc: options?.preferredRootDoc,
      pageId: options?.pageId,
    });

    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(spaceId)}/import/zip${qs}`,
      'POST',
      toFileFormData(file),
    );
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Import ZIP failed'));
    }
    return (await res.json()) as ImportZipResult;
  },

  importFromUrl: async (
    spaceId: string,
    input: ImportFromUrlInput,
  ): Promise<ImportFromUrlResult> => {
    const cleanPageId = input.pageId?.trim();
    return apiPost<ImportFromUrlResult>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(spaceId)}/import/url`,
      {
        url: input.url.trim(),
        ...(input.filename?.trim() ? { filename: input.filename.trim() } : {}),
        ...(cleanPageId ? { pageId: cleanPageId } : {}),
      },
    );
  },

  convertDocument: async (
    spaceId: string,
    file: File | Blob,
    options?: { format?: 'docx' | 'md'; pageId?: string },
  ): Promise<ImportZipResult> => {
    const qs = buildQuery({
      format: options?.format,
      pageId: options?.pageId,
    });

    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(spaceId)}/import/convert${qs}`,
      'POST',
      toFileFormData(file),
    );
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Document conversion failed'));
    }
    return (await res.json()) as ImportZipResult;
  },

  exportDocument: (
    docId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> =>
    apiPost<ExportFileResult>(
      `${PAGES_API_BASE}/docs/${encodeURIComponent(docId)}/export`,
      { format, includeChildren },
    ),
};
