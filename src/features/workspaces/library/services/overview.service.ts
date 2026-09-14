import { apiGet } from '@/shared/lib/api';
import type { Item } from '@/features/workspaces/library/types/library.types';

export interface LibraryOverviewData {
  recentItems: Item[];
  unfiledCount: number;
  trashCount: number;
  starredCount: number;
  duplicateCount: number;
  myPublicationsCount: number;
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageCollections: boolean;
  };
  topTags: Array<{
    id: string;
    name: string;
    color?: string | null;
    count: number;
  }>;
}

export const LibraryOverviewService = {
  getOverview: async (scopeId?: string): Promise<LibraryOverviewData> => {
    const isProject = scopeId && scopeId !== 'user';
    const url = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/overview`
      : `/api/v1/library/overview`;
    return apiGet<LibraryOverviewData>(url);
  },
};
