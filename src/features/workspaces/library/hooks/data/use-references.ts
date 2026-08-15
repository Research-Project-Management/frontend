'use client';

import { useMutation } from '@tanstack/react-query';
import { fetchReferenceByDoi, searchReferences } from '../../services/reference.services';

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
