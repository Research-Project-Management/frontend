import * as api from "@/shared/lib/api";
import { logger } from "@/shared/lib/utils";
import type { FormattedCitation, CslStyle, ReferenceData, CslStyleMetadata, ExportBundleResponse } from '@/features/library/types/library.types';
import { isProjectScope } from '@/features/library/domain/item-url';

export type { ReferenceData, CslStyleMetadata };

function getCitationUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/citation`
    : `/api/v1/library/citation`;
  return suffix ? `${base}/${suffix}` : base;
}

function getExportsUrl(scopeId?: string, suffix = ''): string {
  const base = isProjectScope(scopeId)
    ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/exports`
    : `/api/v1/library/exports`;
  return suffix ? `${base}/${suffix}` : base;
}
function extractReferenceData(response: unknown): ReferenceData | null {
  if (!response || typeof response !== 'object') return null;
  const res = response as Record<string, unknown>;
  if (res.found === false) return null;
  const candidate = (res.metadata || res.work || res.data || res) as Partial<ReferenceData> | undefined;
  if (!candidate || typeof candidate !== 'object') return null;
  return {
    ...candidate,
    title: candidate.title || '',
  } as ReferenceData;
}

export async function fetchReferenceByDoi(
  doi: string,
  _scopeId?: string,
): Promise<ReferenceData | null> {
  const rawDoi = typeof doi === 'string' ? doi.trim() : '';
  if (!rawDoi) {
    throw new Error('Invalid DOI provided');
  }

  const resolveUrl = `/api/v1/library/citation/resolve`;

  try {
    const referenceResponse = await api.apiPost<unknown>(
      resolveUrl,
      { doi: rawDoi, query: rawDoi },
      { silent: true },
    );
    return extractReferenceData(referenceResponse);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; response?: { status?: number } };
    if (err?.statusCode === 404 || err?.response?.status === 404) {
      return null;
    }
    // Fallback: GET by encoded DOI
    try {
      const doiUrl = `/api/v1/library/citation/doi/${encodeURIComponent(rawDoi)}`;
      const fallback = await api.apiGet<unknown>(
        doiUrl,
        { silent: true },
      );
      return extractReferenceData(fallback);
    } catch (fallbackError: unknown) {
      const fbErr = fallbackError as {
        statusCode?: number;
        response?: { status?: number };
      };
      if (
        fbErr?.statusCode === 404 ||
        fbErr?.response?.status === 404
      ) {
        return null;
      }
      throw fallbackError;
    }
  }
}

export async function searchReferences(
  query: string,
  _scopeId?: string,
): Promise<ReferenceData[]> {
  if (!query || !query.trim()) return [];

  const trimmedQuery = query.trim();
  const searchUrl = `/api/v1/library/citation/crossref/search?query=${encodeURIComponent(trimmedQuery)}&rows=10`;

  try {
    const response = await api.apiGet<{
      works?: ReferenceData[];
      results?: ReferenceData[];
      data?: ReferenceData[];
    }>(
      searchUrl,
      { silent: true },
    );

    if (response?.works && Array.isArray(response.works)) {
      return response.works;
    }
    if (response?.results && Array.isArray(response.results)) {
      return response.results;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response)) {
      return response as ReferenceData[];
    }
    return [];
  } catch (error: unknown) {
    logger.warn('Academic work search failed', { query: trimmedQuery, error });
    return [];
  }
}

export async function resolveAcademicWork(
  query: string,
  scopeId?: string,
): Promise<ReferenceData | null> {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) return null;

  try {
    const referenceResponse = await api.apiPost<unknown>(
      `/api/v1/library/citation/resolve`,
      { query: trimmed },
      { silent: true },
    );
    const resolved = extractReferenceData(referenceResponse);
    if (resolved) return resolved;
  } catch {
    // Fall back to searchReferences below if direct resolution returns 404/error
  }

  const results = await searchReferences(trimmed, scopeId);
  return results.length > 0 ? results[0] : null;
}

export const CitationService = {
  fetchByDoi: fetchReferenceByDoi,
  search: searchReferences,
  resolve: resolveAcademicWork,
  resolveDoi: fetchReferenceByDoi,

  /**
   * Format item citation (GET /citation/item/:itemId)
   */
  formatCitation: (
    scopeId: string | undefined,
    itemId: string,
    style: CslStyle = 'apa',
    index: number = 1,
  ) => {
    const projectQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return api.apiGet<FormattedCitation>(
      `${getCitationUrl(scopeId, 'items')}/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(style)}&index=${index}${projectQuery}`,
    );
  },

  /**
   * Get available CSL styles (GET /citation/styles)
   */
  getStyles: (scopeId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return api.apiGet<import('@/features/library/types/library.types').StyleSummary[]>(
      `${getCitationUrl(scopeId, 'styles')}${projectQuery}`,
    );
  },

  /**
   * Search CSL styles with metadata (GET /citation/styles/search)
   */
  searchStyles: (query: string = '', limit: number = 30) => {
    return api.apiGet<{ styles: CslStyleMetadata[]; total: number }>(
      `/api/v1/library/citation/styles/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  /**
   * Upload custom CSL XML style (POST /citation/styles/custom)
   */
  uploadCustomStyle: (xml: string, title?: string) => {
    return api.apiPost<{ styleId?: string; id?: string; title: string; message: string }>(
      `/api/v1/library/citation/styles/custom`,
      { xml, title },
    ).then((res) => ({
      ...res,
      id: res.id || res.styleId || '',
      styleId: res.styleId || res.id || '',
    }));
  },

  /**
   * Batch format multiple items in a single style
   * Backed by POST /citation/batch-items
   */
  batchFormat: (
    scopeId: string | undefined,
    itemIds: string[],
    style: CslStyle = 'apa',
  ) => {
    const projectId = isProjectScope(scopeId) ? scopeId : undefined;
    return api.apiPost<{
      style: CslStyle;
      total: number;
      combinedInText?: string;
      bibliographyText?: string;
      bibliographyHtml?: string;
      citations: Array<{ paperId: string; itemId?: string; citation: FormattedCitation }>;
    }>(
      getCitationUrl(scopeId, 'batch-items'),
      {
        itemIds,
        paperIds: itemIds,
        style,
        ...(projectId ? { projectId } : {}),
      },
    );
  },

  /**
   * Format raw item metadata into citation string without requiring item persistence
   * Backed by POST /citation/format
   */
  formatRawItem: (
    _scopeId: string | undefined,
    item: Record<string, unknown>,
    styleId: string = 'apa-7th',
    index: number = 1,
  ) =>
    api.apiPost<FormattedCitation>(
      `/api/v1/library/citation/format`,
      { item, styleId, index },
    ),

  /**
   * Batch format raw item metadata into citation strings without requiring item persistence
   * Backed by POST /citation/batch
   */
  formatRawBatch: (
    _scopeId: string | undefined,
    items: Record<string, unknown>[],
    styleId: string = 'apa-7th',
  ) =>
    api.apiPost<{
      styleId: string;
      citations: Array<{ id?: string; inText: string; bibliography: string }>;
      bibliographyText: string;
    }>(
      `/api/v1/library/citation/batch`,
      { items, styleId },
    ),
};

export const ExportService = {
  /**
   * Export library with format and filters (POST /exports)
   */
  exportLibrary: (
    scopeId?: string,
    options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      projectId?: string;
    },
  ) => {
    const projectId =
      options?.projectId ||
      (isProjectScope(scopeId) ? scopeId : undefined);
    return api.apiPost<{ content: string; filename: string; itemCount: number }>(
      getExportsUrl(scopeId),
      {
        ...options,
        ...(projectId ? { projectId } : {}),
      },
    );
  },

  /**
   * Export citations by specific citation keys in BibTeX format (POST /exports/citations/bibtex)
   */
  exportByCitationKeys: (scopeId?: string, keys: string[] = []) =>
    api.apiPost<{
      content: string;
      bibtex: string;
      count: number;
      foundKeys?: string[];
      missingKeys?: string[];
    }>(
      getExportsUrl(scopeId, 'citations/bibtex'),
      {
        keys,
        ...(isProjectScope(scopeId) ? { projectId: scopeId } : {}),
      },
    ),

  /**
   * Export collection items to BibTeX format
   */
  exportBibtex: (scopeId?: string, collectionId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `&projectId=${encodeURIComponent(scopeId!)}` : '';
    return api.apiGet<{ bibtex: string; total: number; filename: string }>(
      `${getExportsUrl(scopeId)}?format=bibtex&collectionId=${encodeURIComponent(collectionId || '')}${projectQuery}`,
    );
  },

  /**
   * Export full bundle containing BibTeX and associated file metadata
   */
  exportBundle: (scopeId?: string, collectionId?: string) =>
    api.apiGet<ExportBundleResponse>(
      `${getExportsUrl(scopeId)}/${encodeURIComponent(collectionId || '')}/export-bundle`,
    ),

  /**
   * Export item PDF with baked annotations (highlights, sticky notes, rectangles)
   */
  exportAnnotatedPdf: (scopeId?: string, itemId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return api.apiGet<{ filename: string; mimeType: string; base64: string }>(
      `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId || '')}/annotated-pdf${projectQuery}`,
    );
  },

  /**
   * Download item PDF with baked annotations directly in browser
   */
  downloadAnnotatedPdf: async (scopeId?: string, itemId?: string, fallbackFilename?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    const endpoint = `${getExportsUrl(scopeId)}/items/${encodeURIComponent(itemId || '')}/annotated-pdf${projectQuery}`;

    let blob: Blob;
    let resolvedFilename = fallbackFilename || 'annotated-document.pdf';

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/pdf, application/json',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/pdf')) {
        const disposition = response.headers.get('content-disposition');
        if (disposition) {
          const filenameMatch = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?;?/i);
          if (filenameMatch?.[1]) {
            resolvedFilename = decodeURIComponent(filenameMatch[1]);
          }
        }
        blob = await response.blob();
      } else {
        const res: { filename?: string; mimeType?: string; base64?: string } = response.ok
          ? ((await response.json()) as { filename?: string; mimeType?: string; base64?: string })
          : await api.apiGet<{ filename: string; mimeType: string; base64: string }>(endpoint);
        if (!res || !res.base64) {
          throw new Error('Failed to generate annotated PDF: No content received');
        }
        if (res.filename) {
          resolvedFilename = res.filename;
        }
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: res.mimeType || 'application/pdf' });
      }
    } catch {
      const res = await api.apiGet<{ filename: string; mimeType: string; base64: string }>(endpoint);
      if (!res || !res.base64) {
        throw new Error('Failed to generate annotated PDF: No content received');
      }
      if (res.filename) {
        resolvedFilename = res.filename;
      }
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: res.mimeType || 'application/pdf' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resolvedFilename;
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return { filename: resolvedFilename, mimeType: 'application/pdf' };
  },
};

// Convenience Exports
export const exportBibtex = ExportService.exportBibtex;
export const exportBundle = ExportService.exportBundle;
export const exportAnnotatedPdf = ExportService.exportAnnotatedPdf;
export const downloadAnnotatedPdf = ExportService.downloadAnnotatedPdf;
export const exportLibrary = ExportService.exportLibrary;
export const exportByCitationKeys = ExportService.exportByCitationKeys;

export const CitationDomainService = {
  citation: CitationService,
  exports: ExportService,
};
