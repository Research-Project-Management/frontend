'use client';

import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import UploadModal from '../components/system/UploadModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import { useLibrary } from '../hooks/library/use-library';
import { getLibraryEntityId } from '../utils/library.util';
import { filterFavoritePapers } from '../utils/favorites.util';
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
    uploadOpen,
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
    handleBatchDeletePapers,
    handleBatchMovePapers,
  } = actions;

  const starredPapers = useMemo(() => {
    return papers
      .filter((p) => !p.deletedAt && (Boolean(p.isFavorite) || p.labels?.includes('starred') || Boolean((p as any).isStarred)))
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
    const paperId = getLibraryEntityId(paper);
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
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
        {/* Central Papers Table */}
        <PaperTable
          papers={starredPapers}
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
          onAddPaper={() => handleOpenUpload('file')}
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
