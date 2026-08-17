'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell';

import { useCollections } from '../data/use-collections';
import { usePapers } from '../data/use-papers';
import { filterPapers } from '../../utils/filter';
import { getLibraryEntityId } from '../../utils/library.util';
import type { Paper, CollectionInput } from '../../types/library.types';

export function useLibrary() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag');
  const activeFilter = searchParams.get('filter');

  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = getLibraryEntityId(workspace) || workspaceUrl || '';

  const paperService = usePapers({ workspaceId, collectionId: '' });
  const papersResult = paperService.state.allPapers;
  const isLoading = paperService.state.isLoadingAll;
  const collectionService = useCollections(workspaceId);

  const papers = papersResult ?? [];
  const collections = collectionService.state.collections;

  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'folder' | 'link'>('file');
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);

  const handleOpenUpload = (mode: 'file' | 'folder' | 'link' = 'file') => {
    setUploadMode(mode);
    setUploadOpen(true);
  };

  const collectionMap = useMemo(
    () => Object.fromEntries(collections.map((c) => [getLibraryEntityId(c), c])),
    [collections],
  );

  // Duplicates calculation
  const duplicatePaperIds = useMemo(() => {
    const doiMap = new Map<string, string[]>();
    const titleMap = new Map<string, string[]>();

    for (const p of papers) {
      if (p.deletedAt) continue;
      const pId = getLibraryEntityId(p);
      if (p.doi && p.doi.trim()) {
        const d = p.doi.trim().toLowerCase();
        doiMap.set(d, [...(doiMap.get(d) || []), pId]);
      }
      if (p.title && p.title.trim()) {
        const t = p.title.trim().toLowerCase();
        titleMap.set(t, [...(titleMap.get(t) || []), pId]);
      }
    }

    const dupIds = new Set<string>();
    for (const ids of doiMap.values()) {
      if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
    }
    for (const ids of titleMap.values()) {
      if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
    }
    return dupIds;
  }, [papers]);

  const filtered = useMemo(() => {
    let result = papers;

    // Normal views exclude trash unless viewing trash
    if (activeFilter === 'trash') {
      result = result.filter((p) => Boolean(p.deletedAt));
    } else {
      result = result.filter((p) => !p.deletedAt);
    }

    // Apply smart filters
    if (activeFilter === 'starred') {
      result = result.filter(
        (p) => p.labels?.includes('starred') || p.labels?.includes('favorite')
      );
    } else if (activeFilter === 'recent-read') {
      const readPapers = result.filter((p) => Boolean(p.accessedAt));
      if (readPapers.length > 0) {
        result = readPapers.sort(
          (a, b) =>
            new Date(b.accessedAt || 0).getTime() -
            new Date(a.accessedAt || 0).getTime()
        );
      } else {
        // Fallback to recently created if none accessed
        result = [...result].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
      }
    } else if (activeFilter === 'unfiled') {
      result = result.filter((p) => !p.collectionId);
    } else if (activeFilter === 'duplicates') {
      result = result.filter((p) => duplicatePaperIds.has(getLibraryEntityId(p)));
    }

    // Apply tag filter
    if (activeTag) {
      result = result.filter((p) => p.labels && p.labels.includes(activeTag));
    }

    // Apply search query filter
    result = filterPapers(result, search);

    return result;
  }, [papers, search, activeFilter, activeTag, duplicatePaperIds]);

  const selectedPaper = useMemo(
    () => papers.find((p: Paper) => getLibraryEntityId(p) === selectedPaperId) || null,
    [papers, selectedPaperId],
  );

  const handleAddPaper = async (paperData: Parameters<typeof paperService.actions.addPaper>[0]) => {
    return await paperService.actions.addPaper(paperData);
  };

  const handleCreateCollection = (collectionData: CollectionInput) => {
    collectionService.actions.create(collectionData, {
      onSuccess: () => setCreateCollectionOpen(false),
    });
  };

  const handleDeletePaper = (paperId: string) => {
    if (!confirm('Remove this paper?')) return;
    paperService.actions.deletePaper({ paperId });
    if (selectedPaperId === paperId) setSelectedPaperId(null);
  };

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

  const selectedCollection = useMemo(
    () => (selectedPaper?.collectionId ? collectionMap[selectedPaper.collectionId] ?? null : null),
    [selectedPaper, collectionMap],
  );

  return {
    state: {
      workspaceId,
      workspaceUrl,
      papers,
      collections,
      isLoading,
      search,
      activeTag,
      activeFilter,
      selectedPaperId,
      filtered,
      selectedPaper,
      selectedCollection,
      collectionMap,
      uploadOpen,
      uploadMode,
      createCollectionOpen,
      isAddingPaper: paperService.state.isAdding,
      isCreatingCollection: collectionService.state.isCreating,
    },
    actions: {
      setSearch,
      setSelectedPaperId,
      setUploadOpen,
      setUploadMode,
      handleOpenUpload,
      setCreateCollectionOpen,
      handleAddPaper,
      handleCreateCollection,
      handleDeletePaper,
      handleBatchDeletePapers,
      handleBatchMovePapers,
      navigate: router.push,
    },
  };
}
