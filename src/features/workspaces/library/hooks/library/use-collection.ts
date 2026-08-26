'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { usePapers } from './use-papers';
import { useCollections } from './use-collections';
import { filterAndSortLibraryPapers } from '../../utils/filter.util';
import type { Paper } from '../../types/library.types';

export function useCollection() {
  const { workspaceId: workspaceSlug, collectionId } = useParams() as {
    workspaceId: string;
    collectionId: string;
  };
  const router = useRouter();
  const { workspace } = useWorkspace(workspaceSlug!);
  const workspaceId = workspace?.id || workspaceSlug || '';

  const paperService = usePapers({ workspaceId, collectionId: collectionId ?? '' });
  const collectionPapers = useMemo(
    () => paperService.state.collectionPapers?.papers ?? [],
    [paperService.state.collectionPapers?.papers],
  );
  const isLoading = paperService.state.isLoadingCollection;
  const collectionService = useCollections(workspaceId);
  const collections = collectionService.state.collections;

  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);

  const collectionMap = useMemo(
    () => Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    [collections],
  );

  const currentCollection = useMemo(
    () => (collectionId ? collectionMap[collectionId] ?? null : null),
    [collectionId, collectionMap],
  );

  const filteredPapers = useMemo(() => {
    return filterAndSortLibraryPapers({
      papers: collectionPapers,
      searchQuery: search,
    });
  }, [collectionPapers, search]);

  const selectedPaper = useMemo(
    () => collectionPapers.find((paper: Paper) => paper.id === selectedPaperId) || null,
    [collectionPapers, selectedPaperId],
  );

  return {
    state: {
      workspaceId,
      workspaceSlug,
      collectionId,
      currentCollection,
      papers: collectionPapers,
      filteredPapers,
      collections,
      collectionMap,
      isLoading,
      search,
      selectedPaperId,
      selectedPaper,
      addLinkOpen: isAddLinkModalOpen,
      createCollectionOpen: isCreateCollectionModalOpen,
      isAddingPaper: paperService.state.isAdding,
      isCreatingCollection: collectionService.state.isCreating,
    },
    actions: {
      setSearch,
      setSelectedPaperId,
      setAddLinkOpen: setIsAddLinkModalOpen,
      setCreateCollectionOpen: setIsCreateCollectionModalOpen,
      handleAddPaper: paperService.actions.addPaper,
      handleDeletePaper: paperService.actions.deletePaper,
      navigate: router.push,
    },
  };
}
