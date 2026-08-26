'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { libraryKeys } from '../../services/library.service';
import {
  fetchReferenceByDoi,
  searchReferences,
  formatCslCitation,
} from '../../services/reference.service';
import type { CslStyle } from '../../types/library.types';

export function useReferences() {
  const lookupDoiMutation = useMutation({
    mutationFn: fetchReferenceByDoi,
  });

  const searchCrossrefMutation = useMutation({
    mutationFn: (query: string) => searchReferences(query),
  });

  return {
    state: {
      isLookingUp: lookupDoiMutation.isPending,
      isSearching: searchCrossrefMutation.isPending,
    },
    actions: {
      lookupDoi: lookupDoiMutation.mutateAsync,
      searchCrossref: searchCrossrefMutation.mutateAsync,
    },
  };
}

export function useCslCitation(
  workspaceId: string,
  paperId: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: libraryKeys.citationItem(workspaceId, paperId, style, index),
    queryFn: () => formatCslCitation(workspaceId, paperId, style, index),
    enabled: Boolean(workspaceId && paperId),
    staleTime: 1000 * 60 * 30,
  });
}
