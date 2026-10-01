import { apiGet, apiPost } from "@/shared/lib/api";
import { logger } from "@/shared/lib/utils";
import type { FormattedCitation, CslStyle, ReferenceData, CslStyleMetadata, ExportBundleResponse } from '../../types/library.types';
import { cleanDoi, isProjectScope } from '../../domain';

export type { ReferenceData, CslStyleMetadata };

export async function fetchReferenceByDoi(
  doi: string,
  _scopeId?: string,
): Promise<ReferenceData | null> {
  const normalizedDoi = cleanDoi(doi);
  if (!normalizedDoi) {
    throw new Error('Invalid DOI provided');
  }

  const resolveUrl = `/api/v1/library/citation/resolve`;

  try {
    const referenceResponse = await apiPost<{
      work?: ReferenceData;
      data?: ReferenceData;
      metadata?: ReferenceData;
      found?: boolean;
    } | ReferenceData>(
      resolveUrl,
      { doi: normalizedDoi },
      { silent: true },
    );
    const res = referenceResponse as any;
    if (res?.found === false) return null;
    if (res?.metadata) return res.metadata as ReferenceData;
    if (res?.work) return res.work as ReferenceData;
    if (res?.data) return res.data as ReferenceData;
    return referenceResponse as ReferenceData;
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.response?.status === 404) {
      return null;
    }
    // Fallback: GET by encoded DOI
    try {
      const doiUrl = `/api/v1/library/citation/doi/${encodeURIComponent(normalizedDoi)}`;
      const fallback = await apiGet<{
        work?: ReferenceData;
        data?: ReferenceData;
        metadata?: ReferenceData;
        found?: boolean;
      } | ReferenceData>(
        doiUrl,
        { silent: true },
      );
      const fb = fallback as any;
      if (fb?.found === false) return null;
      if (fb?.metadata) return fb.metadata as ReferenceData;
      if (fb?.work) return fb.work as ReferenceData;
      if (fb?.data) return fb.data as ReferenceData;
      return fallback as ReferenceData;
    } catch (fallbackError: any) {
      if (
        fallbackError?.statusCode === 404 ||
        fallbackError?.response?.status === 404
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
  const searchUrl = `/api/v1/library/citation/search`;

  try {
    const response = await apiPost<{
      results?: ReferenceData[];
      works?: ReferenceData[];
      data?: ReferenceData[];
    }>(
      searchUrl,
      { query: trimmedQuery },
      { silent: true },
    );

    if (response?.results && Array.isArray(response.results)) {
      return response.results;
    }
    if (response?.works && Array.isArray(response.works)) {
      return response.works;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response)) {
      return response as ReferenceData[];
    }
    return [];
  } catch (error: any) {
    logger.warn('Academic work search failed', { query: trimmedQuery, error });
    return [];
  }
}

export async function resolveAcademicWork(
  query: string,
  scopeId?: string,
): Promise<ReferenceData | null> {
  const normalizedDoi = cleanDoi(query);
  if (normalizedDoi) {
    return fetchReferenceByDoi(normalizedDoi, scopeId);
  }

  const results = await searchReferences(query, scopeId);
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
    return apiGet<FormattedCitation>(
      `/api/v1/library/citation/items/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(style)}&index=${index}${projectQuery}`,
    );
  },

  /**
   * Get available CSL styles (GET /citation/styles)
   */
  getStyles: (scopeId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return apiGet<import('../../types/library.types').StyleSummary[]>(
      `/api/v1/library/citation/styles${projectQuery}`,
    );
  },

  /**
   * Search CSL styles with metadata (GET /citation/styles/search)
   */
  searchStyles: (query: string = '', limit: number = 30) => {
    return apiGet<{ styles: CslStyleMetadata[]; total: number }>(
      `/api/v1/library/citation/styles/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  /**
   * Upload custom CSL XML style (POST /citation/styles/custom)
   */
  uploadCustomStyle: (xml: string, title?: string) => {
    return apiPost<{ styleId: string; id: string; title: string; message: string }>(
      `/api/v1/library/citation/styles/custom`,
      { xml, title },
    ).then((res) => ({
      ...res,
      id: (res as any)?.id || (res as any)?.styleId || '',
      styleId: (res as any)?.styleId || (res as any)?.id || '',
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
    return apiPost<{
      style: CslStyle;
      total: number;
      citations: Array<{ paperId: string; citation: FormattedCitation }>;
    }>(
      `/api/v1/library/citation/batch-items`,
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
    item: Record<string, any>,
    styleId: string = 'apa-7th',
    index: number = 1,
  ) =>
    apiPost<FormattedCitation>(
      `/api/v1/library/citation/format`,
      { item, styleId, index },
    ),

  /**
   * Batch format raw item metadata into citation strings without requiring item persistence
   * Backed by POST /citation/batch
   */
  formatRawBatch: (
    _scopeId: string | undefined,
    items: Record<string, any>[],
    styleId: string = 'apa-7th',
  ) =>
    apiPost<{
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
    return apiPost<{ content: string; filename: string; itemCount: number }>(
      `/api/v1/library/exports`,
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
    apiPost<{ bibtex: string; count: number }>(
      `/api/v1/library/exports/citations/bibtex`,
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
    return apiGet<{ bibtex: string; total: number; filename: string }>(
      `/api/v1/library/exports?format=bibtex&collectionId=${encodeURIComponent(collectionId || '')}${projectQuery}`,
    );
  },

  /**
   * Export full bundle containing BibTeX and associated file metadata
   */
  exportBundle: (_scopeId?: string, collectionId?: string) =>
    apiGet<ExportBundleResponse>(
      `/api/v1/library/exports/${encodeURIComponent(collectionId || '')}/export-bundle`,
    ),

  /**
   * Export item PDF with baked annotations (highlights, sticky notes, rectangles)
   */
  exportAnnotatedPdf: (scopeId?: string, itemId?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    return apiGet<{ filename: string; mimeType: string; base64: string }>(
      `/api/v1/library/exports/items/${encodeURIComponent(itemId || '')}/annotated-pdf${projectQuery}`,
    );
  },

  /**
   * Download item PDF with baked annotations directly in browser
   */
  downloadAnnotatedPdf: async (scopeId?: string, itemId?: string, fallbackFilename?: string) => {
    const projectQuery = isProjectScope(scopeId) ? `?projectId=${encodeURIComponent(scopeId!)}` : '';
    const res = await apiGet<{ filename: string; mimeType: string; base64: string }>(
      `/api/v1/library/exports/items/${encodeURIComponent(itemId || '')}/annotated-pdf${projectQuery}`,
    );
    if (!res || !res.base64) {
      throw new Error('Failed to generate annotated PDF: No content received');
    }
    const byteCharacters = atob(res.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: res.mimeType || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename || fallbackFilename || 'annotated-document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return res;
  },
};

// Aliases
export const ReferenceService = CitationService;
export const formatCslCitation = CitationService.formatCitation;
export const batchFormatCslCitations = CitationService.batchFormat;
export const resolveAcademicQuery = CitationService.resolve;
export const formatRawCitation = CitationService.formatRawItem;
export const batchFormatRawCitations = CitationService.formatRawBatch;

export const ExportsService = ExportService;
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
