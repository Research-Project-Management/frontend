'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';

import { useCollections } from '../data/use-collections';
import { usePapers } from '../data/use-papers';
import { filterPapers } from '../../utils/library.util';
import type { Paper, Collection, CollectionInput } from '../../types/library.types';

export function useCollection() {
  const { workspaceId: workspaceUrl, collectionId } = useParams() as { workspaceId: string; collectionId: string };
  const router = useRouter();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl || '';

  const paperService = usePapers({ workspaceId, collectionId: collectionId ?? '' });
  const collectionResult = paperService.state.collectionPapers;
  const isLoading = paperService.state.isLoadingCollection;
  const collectionService = useCollections(workspaceId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'folder' | 'link'>('file');
  const [subCreateOpen, setSubCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const handleOpenUpload = (mode: 'file' | 'folder' | 'link' = 'file') => {
    setUploadMode(mode);
    setUploadOpen(true);
  };

  const collection = collectionResult ? collectionResult.collection : undefined;
  const papers = useMemo(() => (collectionResult ? collectionResult.papers : []), [collectionResult]);
  const collections = collectionService.state.collections;

  const selectedPaper = useMemo(
    () => papers.find((p: Paper) => p.id === selectedPaperId) || null,
    [papers, selectedPaperId],
  );
  const filtered = useMemo(() => filterPapers(papers, search), [papers, search]);

  const handleAddPaper = async (paperData: Parameters<typeof paperService.actions.addPaper>[0]) => {
    return await paperService.actions.addPaper(paperData);
  };

  const handleDeletePaper = (paperId: string) => {
    if (!confirm('Remove this paper from the collection?')) return;
    paperService.actions.deletePaper({ paperId });
    if (selectedPaperId === paperId) setSelectedPaperId(null);
  };

  const handleCreateSub = (collectionData: CollectionInput) => {
    collectionService.actions.create(
      { ...collectionData, parent: collectionId },
      { onSuccess: () => setSubCreateOpen(false) },
    );
  };

  const visibleBreadcrumbs = useMemo(() => {
    const crumbs: Collection[] = [];
    if (collections && collection) {
      let currentId: string | null | undefined = collection.id;
      const seen = new Set<string>();
      while (currentId) {
        if (seen.has(currentId)) break;
        seen.add(currentId);
        const item: Collection | undefined = collections.find((c) => c.id === currentId);
        if (!item) break;
        crumbs.unshift(item);
        currentId = item.parentId || item.parent;
      }
    }

    if (crumbs.length > 4) {
      return [
        crumbs[0],
        { isEllipsis: true, id: 'ellipsis' } as any,
        crumbs[crumbs.length - 2],
        crumbs[crumbs.length - 1],
      ];
    }
    return crumbs;
  }, [collections, collection]);

  const handleBatchDeletePapers = (paperIds: string[]) => {
    for (const paperId of paperIds) {
      paperService.actions.deletePaper({ paperId });
    }
    if (selectedPaperId && paperIds.includes(selectedPaperId)) {
      setSelectedPaperId(null);
    }
  };

  const handleBatchMovePapers = (paperIds: string[], targetCollectionId: string | null) => {
    for (const paperId of paperIds) {
      paperService.actions.updatePaper({ paperId, collectionId: targetCollectionId ?? undefined });
    }
  };

  return {
    state: {
      workspaceId,
      workspaceUrl,
      collectionId,
      collections,
      isLoading,
      collection,
      papers,
      search,
      selectedPaperId,
      selectedPaper,
      filtered,
      uploadOpen,
      uploadMode,
      subCreateOpen,
      visibleBreadcrumbs,
      isAddingPaper: paperService.state.isAdding,
      isCreatingSub: collectionService.state.isCreating,
    },
    actions: {
      setSearch,
      setSelectedPaperId,
      setUploadOpen,
      setUploadMode,
      handleOpenUpload,
      setSubCreateOpen,
      handleAddPaper,
      handleDeletePaper,
      handleBatchDeletePapers,
      handleBatchMovePapers,
      handleCreateSub,
      navigate: router.push,
    },
  };
}
