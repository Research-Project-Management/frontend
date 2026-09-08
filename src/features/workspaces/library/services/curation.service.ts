import { apiGet, apiPost } from '@/shared/lib/api';
import type {
  CatalogItem,
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
  getDuplicates: async (workspaceId: string) => {
    const res = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/duplicates`,
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

  mergePapers: (
    workspaceId: string,
    masterPaperId: string,
    sourcePaperIds: string[],
    fieldSelections?: Record<string, any>,
  ) =>
    apiPost<{
      success: boolean;
      data: {
        masterPaper: CatalogItem;
        mergedCount: number;
        softDeletedPaperIds: string[];
      };
      masterPaper?: CatalogItem;
      mergedCount?: number;
      softDeletedPaperIds?: string[];
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/merge`,
      {
        primaryItemId: masterPaperId,
        duplicateItemIds: sourcePaperIds,
        fieldSelections,
      },
    ),

  getIntegrityReport: async (
    workspaceId: string,
  ): Promise<LibraryIntegrityReport> => {
    const res = await apiGet<any>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/integrity`,
    );
    return res?.data || res;
  },
};

export const CurationService = QualityService;
