import { apiGet, apiPost } from "@/shared/lib/api";
import { logger } from "@/shared/lib/utils";
import type { FormattedCitation, CslStyle, ReferenceData } from '../../types/library.types';
import { cleanDoi, isProjectScope } from '../../domain';

export type { ReferenceData };

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
  rows = 1,
): Promise<{ works: ReferenceData[]; totalResults: number }> {
  try {
    const res = await apiGet<{ works: ReferenceData[]; totalResults: number }>(
      `/api/v1/library/citation/crossref/search`,
      { params: { query, rows: String(rows) } },
    );
    if (res && Array.isArray(res.works)) return res;
    return { works: [], totalResults: 0 };
  } catch (err) {
    logger.warn('[searchReferences] Backend crossref search query failed', { error: err });
    return { works: [], totalResults: 0 };
  }
}

export const CitationService = {
  resolveDoi: fetchReferenceByDoi,
  search: searchReferences,

  /**
   * Get all available CSL citation styles
   * Backed by GET /api/v1/library/citation/styles
   */
  getStyles: (_scopeId?: string) =>
    apiGet<{ styles: Array<{ id: string; name: string; shortName?: string }> }>(
      `/api/v1/library/citation/styles`,
    ),

  /**
   * Multi-source Academic Query Resolver (DOI, arXiv, PubMed PMID, URL, Title)
   */
  resolve: async (query: string, _scopeId?: string) => {
    try {
      const resolveUrl = `/api/v1/library/citation/resolve`;
      const resolutionResponse = await apiPost<{
        query?: string;
        queryType?: string;
        provider?: string;
        metadata?: ReferenceData | null;
        work?: ReferenceData | null;
        data?: ReferenceData | null;
        found?: boolean;
      }>(
        resolveUrl,
        { query },
        { silent: true },
      );

      const metadata =
        resolutionResponse?.metadata ||
        resolutionResponse?.work ||
        resolutionResponse?.data ||
        (resolutionResponse?.found === false ? null : (resolutionResponse as unknown as ReferenceData));

      const hasValidMeta = Boolean(
        metadata &&
          typeof metadata === 'object' &&
          ('title' in metadata ||
            'doi' in metadata ||
            'arxivId' in metadata ||
            'pmid' in metadata ||
            'pmcid' in metadata ||
            'isbn' in metadata),
      );

      return {
        query: resolutionResponse?.query || query,
        queryType: resolutionResponse?.queryType || 'unknown',
        provider: resolutionResponse?.provider || 'CrossRef',
        metadata: hasValidMeta ? metadata : null,
        found: hasValidMeta,
      };
    } catch (caughtError: any) {
      if (
        caughtError?.statusCode === 404 ||
        caughtError?.status === 404 ||
        caughtError?.statusCode === 400
      ) {
        return {
          query,
          queryType: 'unknown',
          provider: 'CrossRef',
          metadata: null,
          found: false,
        };
      }
      throw caughtError;
    }
  },

  /**
   * Format Item metadata into CSL Citation (APA, IEEE, Nature, Harvard, Chicago, MLA, Vancouver)
   */
  formatCitation: (
    scopeId: string | undefined,
    itemId: string,
    style: CslStyle = 'apa',
    index: number = 1,
  ) => {
    const projectId = isProjectScope(scopeId) ? scopeId : undefined;
    return apiGet<FormattedCitation>(
      `/api/v1/library/citation/items/${encodeURIComponent(itemId)}/citation`,
      { params: { style, index, ...(projectId ? { projectId } : {}) } },
    );
  },

  /**
   * Batch Format CSL Citations for multiple persisted item IDs.
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

// Aliases
export const ReferenceService = CitationService;
export const formatCslCitation = CitationService.formatCitation;
export const batchFormatCslCitations = CitationService.batchFormat;
export const resolveAcademicQuery = CitationService.resolve;
export const formatRawCitation = CitationService.formatRawItem;
export const batchFormatRawCitations = CitationService.formatRawBatch;


