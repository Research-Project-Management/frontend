import { apiGet, apiPost } from '@/shared/lib/api';
import type {
  DuplicateGroup,
  LibraryIntegrityReport,
  Paper,
} from '../types/library.types';

export const QualityService = {
  /**
   * 2-Tier Duplicate Paper Detection (Tier 1: DOI, Tier 2: Title + Year +/- 1 + Author)
   */
  getDuplicates: (workspaceId: string) =>
    apiGet<{ duplicateGroups: DuplicateGroup[]; totalDuplicates: number }>(
      `/api/library/quality/${encodeURIComponent(workspaceId)}/duplicates`,
    ),

  /**
   * Atomic Safe Merge: Consolidates notes & labels, transfers attachments, soft-deletes sources
   */
  mergePapers: (
    workspaceId: string,
    masterPaperId: string,
    sourcePaperIds: string[],
  ) =>
    apiPost<{
      message: string;
      masterPaper: Paper;
      mergedCount: number;
      softDeletedPaperIds: string[];
    }>(`/api/library/quality/${encodeURIComponent(workspaceId)}/merge`, {
      masterPaperId,
      sourcePaperIds,
    }),

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
