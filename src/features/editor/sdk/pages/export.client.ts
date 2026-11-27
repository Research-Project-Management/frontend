/**
 * export.client.ts
 *
 * Canonical 1:1 HTTP client for Backend `ExportImportController` (`api/v1/pages`)
 * with single-flight in-flight request coalescing for idempotent export endpoints.
 */

import { apiPost, rawFetch } from '@/shared/lib/api';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import type {
  ExportFileResult,
  ExportZipQuery,
  ImportFromUrlInput,
  ImportFromUrlResult,
  ImportProjectZipResult,
} from './types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';

const inFlightExports = new Map<string, Promise<unknown>>();

function coalesceInFlight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlightExports.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const task = factory().finally(() => {
    inFlightExports.delete(key);
  });
  inFlightExports.set(key, task);
  return task;
}

function buildQuery(
  entries: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === false) continue;
    const str = typeof value === 'boolean' ? 'true' : String(value).trim();
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
  exportProjectZip: (
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

    return coalesceInFlight(`zip:${url}`, async () => {
      const res = await rawFetch(url, 'GET');
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Export ZIP failed'));
      }
      return res.blob();
    });
  },

  importProjectZip: async (
    spaceId: string,
    file: File | Blob,
    options?: { preferredRootDoc?: string; pageId?: string },
  ): Promise<ImportProjectZipResult> => {
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
    return (await res.json()) as ImportProjectZipResult;
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
  ): Promise<ImportProjectZipResult> => {
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
    return (await res.json()) as ImportProjectZipResult;
  },

  scaffoldTemplate: async (
    spaceId: string,
    templateId: string,
    options?: { pageId?: string },
  ): Promise<ImportProjectZipResult> => {
    const cleanPageId = options?.pageId?.trim();
    const qs = buildQuery({ pageId: cleanPageId });
    return apiPost<ImportProjectZipResult>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(spaceId)}/templates/${encodeURIComponent(templateId)}/scaffold${qs}`,
      cleanPageId ? { pageId: cleanPageId } : {},
    );
  },

  exportDocument: (
    docId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> => {
    const key = `doc:${docId}:${format}:${includeChildren}`;
    return coalesceInFlight(key, () =>
      apiPost<ExportFileResult>(
        `${PAGES_API_BASE}/docs/${encodeURIComponent(docId)}/export`,
        { format, includeChildren },
      ),
    );
  },
};
