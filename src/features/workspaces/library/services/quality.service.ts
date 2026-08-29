import { apiGet, apiPost } from '@/shared/lib/api';
import type {
  DuplicateGroup,
  LibraryIntegrityReport,
  Paper,
} from '../types/library.types';

export interface DuplicateCluster {
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

export type CanonicalDuplicateCluster = DuplicateCluster;

export const QualityService = {
  /**
   * 2-Tier Duplicate Paper Detection via Curation API
   */
  getDuplicates: async (workspaceId: string) => {
    const res = await apiGet<{
      success: boolean;
      data: DuplicateCluster[];
    }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/curation/duplicates`,
    );

    const clusters = res?.data || [];
    const duplicateGroups: DuplicateGroup[] = clusters.map((c) => ({
      matchType: c.matchReason === 'EXACT_DOI' ? 'DOI' : 'TITLE_AUTHOR_YEAR',
      confidence: c.confidence >= 1 ? 'high' : 'medium',
      key: c.clusterId,
      papers: c.items.map((it) => ({
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

  /**
   * Atomic Safe Merge via Canonical Curation API
   */
  mergePapers: (
    workspaceId: string,
    masterPaperId: string,
    sourcePaperIds: string[],
    fieldSelections?: Record<string, any>,
  ) =>
    apiPost<{
      success: boolean;
      data: {
        masterPaper: Paper;
        mergedCount: number;
        softDeletedPaperIds: string[];
      };
      masterPaper?: Paper;
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

  /**
   * Library Integrity & Metadata Health Diagnostic Scanner
   */
  getIntegrityReport: (workspaceId: string) =>
    apiGet<LibraryIntegrityReport>(
      `/api/library/quality/${encodeURIComponent(workspaceId)}/integrity`,
    ),
};

// Aliases
export const getDuplicateGroups = QualityService.getDuplicates;
export const mergePapers = QualityService.mergePapers;
export const getLibraryIntegrityReport = QualityService.getIntegrityReport;
