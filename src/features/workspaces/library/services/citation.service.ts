import { apiGet, apiPost } from "@/shared/lib/api";
import { logger } from "@/shared/lib/utils";
import type { FormattedCitation, CslStyle, ReferenceData } from '../types/library.types';
import { cleanDoi } from '../utils/author-doi.util';

export type { ReferenceData };

export async function fetchReferenceByDoi(
  doi: string,
  workspaceId?: string,
): Promise<ReferenceData | null> {
  const normalizedDoi = cleanDoi(doi);
  if (!normalizedDoi) {
    throw new Error('Invalid DOI provided');
  }

  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId && typeof window !== 'undefined') {
    const workspacePathMatch = window.location.pathname.match(
      /^\/([0-9a-fA-F-]{36}|[a-zA-Z0-9_-]+)/,
    );
    if (
      workspacePathMatch &&
      workspacePathMatch[1] &&
      !['login', 'signup', 'auth', 'settings', 'api'].includes(workspacePathMatch[1])
    ) {
      resolvedWorkspaceId = workspacePathMatch[1];
    }
  }

  const resolveUrl =
    resolvedWorkspaceId &&
    resolvedWorkspaceId !== '_' &&
    resolvedWorkspaceId !== 'global'
      ? `/api/v1/workspaces/${encodeURIComponent(resolvedWorkspaceId)}/library/citation/resolve`
      : `/api/v1/library/citation/resolve`;

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
      const doiUrl =
        resolvedWorkspaceId &&
        resolvedWorkspaceId !== '_' &&
        resolvedWorkspaceId !== 'global'
          ? `/api/v1/workspaces/${encodeURIComponent(resolvedWorkspaceId)}/library/citation/doi/${encodeURIComponent(normalizedDoi)}`
          : `/api/v1/library/citation/doi/${encodeURIComponent(normalizedDoi)}`;
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
  } catch {
    // Fallback to direct CrossRef REST API from browser
  }

  try {
    const response = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}`,
      {
        headers: { Accept: 'application/json' },
      },
    );
    if (!response.ok) return { works: [], totalResults: 0 };
    const json = (await response.json()) as any;
    const items = json?.message?.items || [];
    const totalResults = json?.message?.['total-results'] || items.length;

    const works: ReferenceData[] = items.map((message: any) => {
      const title = Array.isArray(message.title)
        ? message.title[0] || 'Untitled'
        : message.title || 'Untitled';
      const authors: string[] = [];
      if (Array.isArray(message.author)) {
        for (const auth of message.author) {
          if (auth.given && auth.family) authors.push(`${auth.family}, ${auth.given}`);
          else if (auth.family) authors.push(auth.family);
          else if (auth.name) authors.push(auth.name);
        }
      }
      let year: number | string = '';
      const dateParts =
        message['published-print']?.['date-parts']?.[0] ||
        message['published-online']?.['date-parts']?.[0] ||
        message.issued?.['date-parts']?.[0];
      if (dateParts && dateParts[0]) year = Number(dateParts[0]);

      return {
        doi: message.DOI || '',
        title,
        authors,
        year,
        journal: Array.isArray(message['container-title'])
          ? message['container-title'][0]
          : message['container-title'] || '',
        publisher: message.publisher || '',
        volume: message.volume || '',
        issue: message.issue || '',
        pages: message.page || '',
        issn: Array.isArray(message.ISSN) ? message.ISSN[0] : message.ISSN || '',
        isbn: Array.isArray(message.ISBN) ? message.ISBN[0] : message.ISBN || '',
        url: message.URL || (message.DOI ? `https://doi.org/${message.DOI}` : ''),
        abstract: message.abstract ? message.abstract.replace(/<[^>]*>/g, '') : '',
        type: message.type || 'journal-article',
        itemType:
          message.type === 'journal-article'
            ? 'journalArticle'
            : message.type || 'journalArticle',
        score: message.score || 0,
      } as ReferenceData;
    });

    return { works, totalResults };
  } catch (err) {
    logger.warn('[searchReferences] CrossRef query failed', { error: err });
    return { works: [], totalResults: 0 };
  }
}

export const CitationService = {
  resolveDoi: fetchReferenceByDoi,
  search: searchReferences,

  /**
   * Get all available CSL citation styles
   * Backed by GET /citation/styles
   */
  getStyles: (workspaceId: string) =>
    apiGet<{ styles: Array<{ id: string; name: string; shortName?: string }> }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/citation/styles`,
    ),

  /**
   * Multi-source Academic Query Resolver (DOI, arXiv, PubMed PMID, URL, Title)
   */
  resolve: async (query: string, workspaceId?: string) => {
    try {
      let resolvedWorkspaceIdentifier = workspaceId;
      if (!resolvedWorkspaceIdentifier && typeof window !== 'undefined') {
        const workspacePathMatch = window.location.pathname.match(
          /^\/([0-9a-fA-F-]{36}|[a-zA-Z0-9_-]+)/,
        );
        if (
          workspacePathMatch &&
          workspacePathMatch[1] &&
          !['login', 'signup', 'auth', 'settings', 'api'].includes(workspacePathMatch[1])
        ) {
          resolvedWorkspaceIdentifier = workspacePathMatch[1];
        }
      }

      const resolveUrl =
        resolvedWorkspaceIdentifier &&
        resolvedWorkspaceIdentifier !== '_' &&
        resolvedWorkspaceIdentifier !== 'global'
          ? `/api/v1/workspaces/${encodeURIComponent(resolvedWorkspaceIdentifier)}/library/citation/resolve`
          : `/api/v1/library/citation/resolve`;
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
    workspaceId: string,
    itemId: string,
    style: CslStyle = 'apa',
    index: number = 1,
  ) =>
    apiGet<FormattedCitation>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/citation/items/${encodeURIComponent(itemId)}/citation`,
      { params: { style, index } },
    ),

  /**
   * Batch Format CSL Citations for multiple persisted item IDs.
   * Backed by POST /citation/batch-items
   */
  batchFormat: (
    workspaceId: string,
    itemIds: string[],
    style: CslStyle = 'apa',
  ) =>
    apiPost<{
      style: CslStyle;
      total: number;
      citations: Array<{ paperId: string; citation: FormattedCitation }>;
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/citation/batch-items`,
      {
        itemIds,
        paperIds: itemIds,
        style,
      },
    ),

  /**
   * Format raw item metadata into citation string without requiring item persistence
   * Backed by POST /citation/format
   */
  formatRawItem: (
    workspaceId: string,
    item: Record<string, any>,
    styleId: string = 'apa-7th',
    index: number = 1,
  ) =>
    apiPost<FormattedCitation>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/citation/format`,
      { item, styleId, index },
    ),
};

// Aliases
export const ReferenceService = CitationService;
export const formatCslCitation = CitationService.formatCitation;
export const batchFormatCslCitations = CitationService.batchFormat;
export const resolveAcademicQuery = CitationService.resolve;
export const formatRawCitation = CitationService.formatRawItem;


