'use client';

import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import AddLinkModal from '../components/system/AddLinkModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import { useLibrary } from '../hooks/library/use-library';
import { filterAndSortLibraryPapers } from '../utils/filter.util';
import type { Paper } from '../types/library.types';

export default function FavoritesPage() {
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

  const favoritePapers = useMemo(() => {
    return filterAndSortLibraryPapers({
      papers,
      searchQuery: search,
      activeFilter: 'starred',
    });
  }, [papers, search]);

  const handleSelectPaper = (paper: Paper) => {
    const paperId = paper.id;
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Left Main Content Area (Topbar + Table) */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Favorites"
          icon={Star}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={handleDirectFilesUpload}
          onDirectFolderUpload={handleDirectFolderUpload}
          onAddCollection={() => setCreateCollectionOpen(true)}
          onAddLink={() => setAddLinkOpen(true)}
        />

        {/* Central Papers Table */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <PaperTable
            papers={favoritePapers}
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
            onAddPaper={() => setAddLinkOpen(true)}
            showCollection={true}
          />
        </div>
      </div>

      {/* Right Inspector Panel */}
      {selectedPaper && (
        <InspectorPanel
          paper={selectedPaper}
          collection={selectedCollection}
          workspaceId={workspaceId}
          onClose={() => setSelectedPaperId(null)}
        />
      )}

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
    </div>
  );
}
