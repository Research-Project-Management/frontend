import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type { RelatedPaperItem } from '../types/library.types';

export const RelationService = {
  /**
   * Get all bi-directionally linked related papers
   */
  getRelated: (workspaceId: string, paperId: string) =>
    apiGet<{ relatedPapers: RelatedPaperItem[]; total: number }>(
      `/api/library/relations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
    ),

  /**
   * Link two papers symmetrically with semantic relation tag (extends, rebuts, uses_dataset...)
   */
  link: (
    workspaceId: string,
    paperId: string,
    targetPaperId: string,
    relationType: string = 'related',
  ) =>
    apiPost<{ message: string; relationType: string }>(
      `/api/library/relations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/link`,
      { targetPaperId, relationType },
    ),

  /**
   * Unlink two papers
   */
  unlink: (workspaceId: string, paperId: string, targetPaperId: string) =>
    apiDelete<{ message: string }>(
      `/api/library/relations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/link/${encodeURIComponent(targetPaperId)}`,
    ),
};

// Aliases
export const getRelatedPapers = RelationService.getRelated;
export const linkPapers = RelationService.link;
export const unlinkPapers = RelationService.unlink;

