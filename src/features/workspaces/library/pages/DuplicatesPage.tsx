'use client';

import React, { useMemo } from 'react';
import { Files } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import AddLinkModal from '../components/system/AddLinkModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import MergeDialog from '../components/system/MergeDialog';
import { useLibrary, useDuplicateGroups, useMergePapers } from '../hooks/library/use-library';
import { useLibrarySidebarStore } from '../store/sidebar.store';
import type { Paper } from '../types/library.types';

export default function DuplicatesPage() {
  const { state, actions } = useLibrary();
  const { setIsInspectorOpen } = useLibrarySidebarStore();
  const {
    workspaceId,
    search,
    selectedPaperId,
    selectedPaper,
    selectedCollection,
    collectionMap,
    collections,
    addLinkOpen,
    createCollectionOpen,
    isAddingPaper,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    setAddLinkOpen,
    handleDirectFilesUpload,
    handleDirectFolderUpload,
    handleAddLinkSubmit,
    setCreateCollectionOpen,
    handleCreateCollection,
    handleDeletePaper,
    handleBatchDeletePapers,
    handleBatchMovePapers,
  } = actions;

  const { data: duplicateData, isLoading: isDupLoading } = useDuplicateGroups(workspaceId);
  const mergeMutation = useMergePapers(workspaceId);

  const duplicateGroups = useMemo(
    () =>
      (duplicateData as any)?.duplicateGroups ||
      (duplicateData as any)?.groups ||
      [],
    [duplicateData],
  );

  const allDuplicatePapers = useMemo(() => {
    const list: Paper[] = [];
    const seen = new Set<string>();
    for (const group of duplicateGroups) {
      for (const p of group.papers) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          list.push(p);
        }
      }
    }
    return list;
  }, [duplicateGroups]);

  const filteredPapers = useMemo(() => {
    if (!search.trim()) return allDuplicatePapers;
    const q = search.toLowerCase();
    return allDuplicatePapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (Array.isArray(p.authors) && p.authors.some((a) => a.toLowerCase().includes(q))) ||
        (p.doi && p.doi.toLowerCase().includes(q)),
    );
  }, [allDuplicatePapers, search]);

  const handleSelectPaper = (paper: Paper) => {
    const paperId = paper.id;
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
    }
  };

  const [mergeCluster, setMergeCluster] = React.useState<Paper[] | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);

  const handleOpenMergeDialog = (clusterPapers: Paper[]) => {
    if (!clusterPapers || clusterPapers.length < 2) return;
    setMergeCluster(clusterPapers);
    setMergeDialogOpen(true);
  };

  const handleExecuteMerge = async (
    masterPaper: Paper,
    _mergedFields: Partial<Paper>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      masterPaperId: masterPaper.id,
      sourcePaperIds: duplicateIdsToDelete,
    });
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Left Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Duplicate Items"
          icon={Files}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={handleDirectFilesUpload}
          onDirectFolderUpload={handleDirectFolderUpload}
          onAddCollection={() => setCreateCollectionOpen(true)}
          onAddLink={() => setAddLinkOpen(true)}
        />

        {/* Central Duplicate Table */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {duplicateGroups.length === 0 && !isDupLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Files className="size-12 mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No duplicates detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                No duplicate papers found by DOI or Title/Author/Year.
              </p>
            </div>
          ) : (
            <PaperTable
              papers={filteredPapers}
              isLoading={isDupLoading}
              isSearch={Boolean(search.trim())}
              selectedPaperId={selectedPaperId}
              onSelectPaper={handleSelectPaper}
              onDeletePaper={handleDeletePaper}
              onBatchDeletePapers={handleBatchDeletePapers}
              onBatchMovePapers={handleBatchMovePapers}
              onClearSearch={() => setSearch('')}
              onAddPaper={() => setAddLinkOpen(true)}
              collectionMap={collectionMap}
              collections={collections}
            />
          )}
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedPaper || null}
        collection={selectedCollection || null}
        workspaceId={workspaceId}
        onClose={() => setSelectedPaperId(null)}
      />

      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingPaper}
      />

      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onSubmit={handleCreateCollection}
        isPending={isCreatingCollection}
        collections={collections}
      />

      {mergeCluster && (
        <MergeDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          duplicates={mergeCluster}
          onMerge={handleExecuteMerge}
        />
      )}
    </div>
  );
}
