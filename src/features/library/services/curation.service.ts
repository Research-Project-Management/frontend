import { apiGet, apiPost } from "@/shared/lib/api";
import type {
  Item,
  DuplicateGroup,
  LibraryIntegrityReport,
} from '../types/library.types';

export interface RawDuplicateCluster {
  clusterId: string;
  matchReason: string;
  confidence: number;
  items: Array<{
    id: string;
    title: string;
    doi?: string;
    year?: number | null;
    authors?: string[];
    citationKey?: string;
    collectionId?: string | null;
  }>;
}

export const QualityService = {
  getDuplicates: async (scopeId?: string) => {
    const scopeParam =
      scopeId && scopeId !== 'user'
        ? `?projectId=${encodeURIComponent(scopeId)}`
        : '';
    const res = await apiGet<any>(
      `/api/v1/library/curation/duplicates${scopeParam}`,
    );

    const clusters: RawDuplicateCluster[] = Array.isArray(res)
      ? res
      : res?.data || res?.clusters || [];

    const duplicateGroups: DuplicateGroup[] = clusters.map((c) => ({
      matchType: c.matchReason === 'EXACT_DOI' ? 'DOI' : 'TITLE_AUTHOR_YEAR',
      confidence: c.confidence >= 1 ? 'high' : 'medium',
      key: c.clusterId,
      papers: (c.items || []).map((it) => ({
        id: it.id,
        title: it.title,
        doi: it.doi || '',
        authors: it.authors || [],
        year: it.year || null,
        citationKey: it.citationKey || '',
        collectionId: it.collectionId || null,
      })) as any,
    }));

    return {
      duplicateGroups,
      totalDuplicates: duplicateGroups.reduce(
        (acc, g) => acc + (g.papers?.length || 0),
        0,
      ),
    };
  },

  mergePapers: async (
    scopeId: string,
    masterPaperId: string,
    sourcePaperIds: string[],
    fieldSelections?: Record<string, any>,
  ) => {
    const scopeParam =
      scopeId && scopeId !== 'user'
        ? `?projectId=${encodeURIComponent(scopeId)}`
        : '';
    const res = await apiPost<any>(
      `/api/v1/library/curation/merge${scopeParam}`,
      {
        primaryItemId: masterPaperId,
        duplicateItemIds: sourcePaperIds,
        fieldSelections,
      },
    );

    const masterPaper = res?.primaryItem || res?.masterPaper || res?.data?.masterPaper;
    const mergedCount = res?.mergedCount ?? res?.data?.mergedCount ?? sourcePaperIds.length;
    const softDeletedPaperIds =
      res?.softDeletedItemIds ||
      res?.softDeletedPaperIds ||
      res?.data?.softDeletedPaperIds ||
      [];

    return {
      success: true,
      data: {
        masterPaper,
        mergedCount,
        softDeletedPaperIds,
      },
      masterPaper,
      primaryItem: masterPaper,
      mergedCount,
      softDeletedPaperIds,
      softDeletedItemIds: softDeletedPaperIds,
    };
  },

  getIntegrityReport: async (
    _scopeId?: string,
  ): Promise<LibraryIntegrityReport> => {
    const res = await apiGet<any>(
      `/api/v1/library/curation/integrity`,
    );
    return res?.data || res;
  },
};

export const CurationService = QualityService;
