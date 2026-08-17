'use client';

import React from 'react';
import { Star } from 'lucide-react';
import Topbar from '../components/library/layout/topbar';
import PaperTable from '../components/library/table/paper-table';
import InspectorPanel from '../components/library/inspector/inspector-panel';
import UploadModal from '../components/library/modals/upload-modal';
import CreateCollectionModal from '../components/library/modals/create-collection-modal';
import { useLibrary } from '../hooks/library/use-library';
import type { Paper } from '../types/library.types';

export default function FavoritesPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    workspaceUrl,
    papers,
    isLoading,
    search,
    selectedPaperId,
    selectedPaper,
    selectedCollection,
    collectionMap,
    collections,
    uploadOpen,
    uploadMode,
    createCollectionOpen,
    isAddingPaper,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    setUploadOpen,
    handleOpenUpload,
    setCreateCollectionOpen,
    handleAddPaper,
    handleCreateCollection,
    handleDeletePaper,
  } = actions;

  const favoritePapers = React.useMemo(() => {
    return papers
      .filter((p) => !p.deletedAt && (p.labels?.includes('starred') || p.labels?.includes('favorite')))
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q))
        );
      });
  }, [papers, search]);

  const handleSelectPaper = (paper: Paper) => {
    if (selectedPaperId === paper._id) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paper._id);
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0 flex-1 overflow-hidden">
      <Topbar
        title="Favorites"
        icon={Star}
        search={search}
        onSearchChange={setSearch}
        onAddPaper={(mode) => handleOpenUpload(mode || 'file')}
        onAddCollection={() => setCreateCollectionOpen(true)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <PaperTable
          papers={favoritePapers}
          collectionMap={collectionMap}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim())}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onBatchDeletePapers={actions.handleBatchDeletePapers}
          onBatchMovePapers={actions.handleBatchMovePapers}
          onClearSearch={() => setSearch('')}
          onAddPaper={() => handleOpenUpload('file')}
          showCollection={true}
        />

        {selectedPaper && (
          <InspectorPanel
            paper={selectedPaper}
            collection={selectedCollection}
            workspaceId={workspaceId}
            onClose={() => setSelectedPaperId(null)}
          />
        )}
      </div>

      {workspaceId && (
        <UploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSubmit={handleAddPaper}
          isPending={isAddingPaper}
          workspaceId={workspaceId}
          initialMode={uploadMode}
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
