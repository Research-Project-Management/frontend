'use client';

import React from 'react';
import { BookOpen, X, Tag, Star, History, Inbox, Files, Trash2 } from 'lucide-react';
import Topbar from '../layout/topbar';
import PaperTable from '../table/paper-table';
import InspectorPanel from '../inspector/inspector-panel';
import UploadModal from '../modals/upload-modal';
import CreateCollectionModal from '../modals/create-collection-modal';
import { useLibrary } from '../../../hooks/library/use-library';
import type { Paper } from '../../../types/library.types';

export default function PapersView() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    workspaceUrl,
    papers,
    isLoading,
    search,
    activeTag,
    activeFilter,
    selectedPaperId,
    filtered,
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
    navigate,
  } = actions;

  const handleSelectPaper = (paper: Paper) => {
    if (selectedPaperId === paper._id) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paper._id);
    }
  };

  const getPageInfo = () => {
    switch (activeFilter) {
      case 'starred':
        return { title: 'Favorites', icon: Star };
      case 'recent-read':
        return { title: 'Recently Read', icon: History };
      case 'unfiled':
        return { title: 'Unfiled Items', icon: Inbox };
      case 'duplicates':
        return { title: 'Duplicate Items', icon: Files };
      case 'trash':
        return { title: 'Trash', icon: Trash2 };
      default:
        return { title: 'Library', icon: BookOpen };
    }
  };

  const { title: pageTitle, icon: PageIcon } = getPageInfo();

  return (
    <div className="flex flex-col h-full min-w-0 flex-1 overflow-hidden">
      <Topbar
        title={pageTitle}
        icon={PageIcon}
        search={search}
        onSearchChange={setSearch}
        onAddPaper={activeFilter !== 'trash' ? (mode) => handleOpenUpload(mode || 'file') : undefined}
        onAddCollection={activeFilter !== 'trash' ? () => setCreateCollectionOpen(true) : undefined}
      />

      {/* Active Tag Filter Indicator */}
      {activeTag && (
        <div className="px-6 py-2 bg-accent/40 border-b border-border/40 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Filtering by tag:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent text-foreground font-medium text-[11px] border border-border/40">
              <Tag className="size-3 text-foreground" />
              {activeTag}
            </span>
          </div>
          <button
            onClick={() => navigate(`/${workspaceUrl}/library`)}
            className="text-xs text-foreground hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>Clear filter</span>
            <X className="size-3 text-foreground" />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Central Papers Table */}
        <PaperTable
          papers={filtered}
          collectionMap={collectionMap}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim()) || Boolean(activeTag) || Boolean(activeFilter)}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onBatchDeletePapers={actions.handleBatchDeletePapers}
          onBatchMovePapers={actions.handleBatchMovePapers}
          onClearSearch={() => {
            setSearch('');
            if (activeTag || activeFilter) navigate(`/${workspaceUrl}/library`);
          }}
          onAddPaper={() => handleOpenUpload('file')}
          showCollection={activeFilter !== 'unfiled'}
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
