'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell';

import { useCollections } from '../data/use-collections';
import { usePapers } from '../data/use-papers';
import { filterPapers } from '../../utils/filter';

export function useCollection() {
  const { workspaceId: workspaceUrl, collectionId } = useParams() as { workspaceId: string; collectionId: string };
  const router = useRouter();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? '';

  const paperService = usePapers({ workspaceId, collectionId: collectionId ?? '' });
  const collectionResult = paperService.state.collectionPapers;
  const isLoading = paperService.state.isLoadingCollection;
  const collectionService = useCollections(workspaceId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [subCreateOpen, setSubCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const collection = collectionResult ? collectionResult.collection : undefined;
  const papers = useMemo(() => (collectionResult ? collectionResult.papers : []), [collectionResult]);
  const collections = collectionService.state.collections;

  const selectedPaper = useMemo(
    () => papers.find((p: any) => p._id === selectedPaperId) || null,
    [papers, selectedPaperId],
  );
  const filtered = useMemo(() => filterPapers(papers, search), [papers, search]);

  const handleAddPaper = async (paperData: Parameters<typeof paperService.actions.addPaper>[0]) => {
    await paperService.actions.addPaper(paperData);
    setUploadOpen(false);
  };

  const handleDeletePaper = (paperId: string) => {
    if (!confirm('Remove this paper from the collection?')) return;
    paperService.actions.deletePaper({ paperId });
    if (selectedPaperId === paperId) setSelectedPaperId(null);
  };

  const handleCreateSub = (collectionData: any) => {
    collectionService.actions.create(
      { ...collectionData, parent: collectionId },
      { onSuccess: () => setSubCreateOpen(false) },
    );
  };

  const visibleBreadcrumbs = useMemo(() => {
    const crumbs = [];
    if (collections && collection) {
      let current: any = collection;
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current._id)) break;
        seen.add(current._id);
        crumbs.unshift(current);
        if (current.parent) {
          const p = collections.find((c) => c._id === current.parent);
          if (p) current = p;
          else break;
        } else {
          break;
        }
      }
    }

    if (crumbs.length > 4) {
      return [
        crumbs[0],
        { isEllipsis: true, _id: 'ellipsis' },
        crumbs[crumbs.length - 2],
        crumbs[crumbs.length - 1],
      ];
    }
    return crumbs;
  }, [collections, collection]);

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
      subCreateOpen,
      visibleBreadcrumbs,
      isAddingPaper: paperService.state.isAdding,
      isCreatingSub: collectionService.state.isCreating,
    },
    actions: {
      setSearch,
      setSelectedPaperId,
      setUploadOpen,
      setSubCreateOpen,
      handleAddPaper,
      handleDeletePaper,
      handleCreateSub,
      navigate: router.push,
    },
  };
}
