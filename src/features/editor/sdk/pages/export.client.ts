/**
 * export.client.ts
 *
 * GoF Facade + Fluent Builder (`QueryStringBuilder`) for Backend `ExportImportController` (`api/v1/pages`):
 * 1. GET  /spaces/:spaceId/export/zip
 * 2. POST /spaces/:spaceId/import/zip
 * 3. POST /spaces/:spaceId/import/url
 * 4. POST /spaces/:spaceId/import/convert
 * 5. POST /spaces/:spaceId/templates/:templateId/scaffold
 * 6. POST /docs/:pageId/export
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

/**
 * GoF Builder Pattern: Fluent query-string construction without repetitive branching.
 */
class QueryStringBuilder {
  private readonly params = new URLSearchParams();

  public flag(key: string, enabled?: boolean): this {
    if (enabled) this.params.set(key, 'true');
    return this;
  }

  public string(key: string, value?: string): this {
    const trimmed = value?.trim();
    if (trimmed) this.params.set(key, trimmed);
    return this;
  }

  public number(key: string, value?: number): this {
    if (value !== undefined) this.params.set(key, String(value));
    return this;
  }

  public build(): string {
    const qs = this.params.toString();
    return qs ? `?${qs}` : '';
  }
}

function createMultipartForm(file: File | Blob): FormData {
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
  exportProjectZip: async (
    spaceId: string,
    query: ExportZipQuery = {},
  ): Promise<Blob> => {
    const cleanPageId = query.pageId?.trim();
    const targetSpaceId = spaceId || cleanPageId || '';
    const qs = new QueryStringBuilder()
      .flag('includePdf', query.includePdf)
      .flag('cleanArxiv', query.cleanArxiv)
      .string('mode', query.mode)
      .number('version', query.version)
      .string('projectName', query.projectName)
      .string('pageId', cleanPageId)
      .build();

    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(targetSpaceId)}/export/zip${qs}`,
      'GET',
    );
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Export ZIP failed'));
    }
    return res.blob();
  },

  importProjectZip: async (
    spaceId: string,
    file: File | Blob,
    options?: { preferredRootDoc?: string; pageId?: string },
  ): Promise<ImportProjectZipResult> => {
    const qs = new QueryStringBuilder()
      .string('preferredRootDoc', options?.preferredRootDoc)
      .string('pageId', options?.pageId)
      .build();

    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(spaceId)}/import/zip${qs}`,
      'POST',
      createMultipartForm(file),
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
    const qs = new QueryStringBuilder()
      .string('format', options?.format)
      .string('pageId', options?.pageId)
      .build();

    const res = await rawFetch(
      `${getPagesBaseUrl()}/spaces/${encodeURIComponent(spaceId)}/import/convert${qs}`,
      'POST',
      createMultipartForm(file),
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
    const qs = new QueryStringBuilder().string('pageId', cleanPageId).build();
    return apiPost<ImportProjectZipResult>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(spaceId)}/templates/${encodeURIComponent(templateId)}/scaffold${qs}`,
      cleanPageId ? { pageId: cleanPageId } : {},
    );
  },

  exportDocument: async (
    docId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> => {
    return apiPost<ExportFileResult>(
      `${PAGES_API_BASE}/docs/${encodeURIComponent(docId)}/export`,
      { format, includeChildren },
    );
  },
};
