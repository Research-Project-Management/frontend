'use client';

import React, { useState, useMemo } from 'react';
import { Files, GitMerge } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import UploadModal from '../components/system/UploadModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import MergeDialog from '../components/duplicates/MergeDialog';
import { useLibrary } from '../hooks/library/use-library';
import { usePapers } from '../hooks/data/use-papers';
import { getLibraryEntityId } from '../utils/library.util';
import { findDuplicateClusters } from '../utils/duplicates.util';
import { Button } from '@/shared/components/ui';
import type { Paper } from '../types/library.types';

export default function DuplicatesPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    papers,
    isLoading,
    search,
    selectedPaperId,
    selectedPaper,
    selectedCollection,
    collectionMap,
    collections,
    uploadOpen,
    createCollectionOpen,
    isAddingPaper,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    setUploadOpen,
    setCreateCollectionOpen,
    handleAddPaper,
    handleCreateCollection,
    handleDeletePaper,
    handleBatchDeletePapers,
    handleBatchMovePapers,
  } = actions;

  const paperDataService = usePapers({ workspaceId });
  const [mergingCluster, setMergingCluster] = useState<Paper[] | null>(null);

  // Group duplicates into clusters
  const duplicateClusters = useMemo(() => {
    const doiMap = new Map<string, Paper[]>();
    const titleMap = new Map<string, Paper[]>();

    for (const p of papers) {
      if (p.deletedAt) continue;
      if (p.doi && p.doi.trim()) {
        const d = p.doi.trim().toLowerCase();
        doiMap.set(d, [...(doiMap.get(d) || []), p]);
      }
      if (p.title && p.title.trim()) {
        const t = p.title.trim().toLowerCase();
        titleMap.set(t, [...(titleMap.get(t) || []), p]);
      }
    }

    const clusters: Paper[][] = [];
    const seenIds = new Set<string>();

    for (const group of doiMap.values()) {
      if (group.length > 1) {
        const unseen = group.filter((p) => !seenIds.has(getLibraryEntityId(p)));
        if (unseen.length > 1) {
          unseen.forEach((p) => seenIds.add(getLibraryEntityId(p)));
          clusters.push(unseen);
        }
      }
    }

    for (const group of titleMap.values()) {
      if (group.length > 1) {
        const unseen = group.filter((p) => !seenIds.has(getLibraryEntityId(p)));
        if (unseen.length > 1) {
          unseen.forEach((p) => seenIds.add(getLibraryEntityId(p)));
          clusters.push(unseen);
        }
      }
    }

    return clusters;
  }, [papers]);

  const allDuplicatePapers = useMemo(() => {
    const list = duplicateClusters.flat();
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q))
    );
  }, [duplicateClusters, search]);

  const handleSelectPaper = (paper: Paper) => {
    const paperId = getLibraryEntityId(paper);
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
    }
  };

  const handleExecuteMerge = async (
    masterPaper: Paper,
    mergedFields: Partial<Paper>,
    duplicateIdsToDelete: string[]
  ) => {
    const masterId = getLibraryEntityId(masterPaper);
    // 1. Update master record with consolidated data
    await paperDataService.actions.updatePaper({ paperId: masterId, ...mergedFields });
    // 2. Delete duplicate records
    for (const dupId of duplicateIdsToDelete) {
      await paperDataService.actions.deletePaper({ paperId: dupId });
    }
    // Refresh
    await paperDataService.actions.refetchAll();
  };

  return (
    <div className="flex flex-col h-full min-w-0 flex-1 overflow-hidden">
      <Topbar
        title="Duplicate Items"
        icon={Files}
        search={search}
        onSearchChange={setSearch}
      >
        {duplicateClusters.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMergingCluster(duplicateClusters[0])}
            className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
          >
            <GitMerge className="size-3.5" />
            <span>Merge Group</span>
          </Button>
        )}
      </Topbar>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Central Papers Table */}
        <PaperTable
          papers={allDuplicatePapers}
          collectionMap={collectionMap}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim())}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onBatchDeletePapers={handleBatchDeletePapers}
          onBatchMovePapers={handleBatchMovePapers}
          onClearSearch={() => setSearch('')}
          showCollection={true}
        />

        {/* Right Inspector Panel */}
        {selectedPaper && (
          <InspectorPanel
            paper={selectedPaper}
            collection={selectedCollection}
            workspaceId={workspaceId}
            onClose={() => setSelectedPaperId(null)}
          />
        )}
      </div>

      {/* Smart Merge Dialog */}
      {mergingCluster && (
        <MergeDialog
          open={Boolean(mergingCluster)}
          onOpenChange={(open) => !open && setMergingCluster(null)}
          duplicates={mergingCluster}
          onMerge={handleExecuteMerge}
        />
      )}

      {workspaceId && (
        <UploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSubmit={handleAddPaper}
          isPending={isAddingPaper}
          workspaceId={workspaceId}
        />
      )}

      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onSubmit={handleCreateCollection}
        isPending={isCreatingCollection}
        collections={collections}
      />
    </div>
  );
}
