'use client';

import React from 'react';
import { BookOpen, FolderOpen, X, Tag, History, Inbox, Files, Trash2 } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import AddLinkModal from '../components/system/AddLinkModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import { useLibrary } from '../hooks/library/use-library';
import type { Paper } from '../types/library.types';

import { useLibrarySidebarStore } from '../store/sidebar.store';

export default function LibraryPage() {
  const { state, actions } = useLibrary();
  const { setIsInspectorOpen } = useLibrarySidebarStore();
  const {
    workspaceId,
    workspaceUrl,
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
    navigate,
  } = actions;

  const handleSelectPaper = (paper: Paper) => {
    const paperId = paper.id;
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
    }
  };

  const getPageInfo = () => {
    if (selectedCollection) {
      return { title: selectedCollection.name, icon: FolderOpen };
    }
    switch (activeFilter) {
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
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Left Main Content Area (Topbar + Table) */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title={pageTitle}
          icon={PageIcon}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={activeFilter !== 'trash' ? handleDirectFilesUpload : undefined}
          onDirectFolderUpload={activeFilter !== 'trash' ? handleDirectFolderUpload : undefined}
          onAddCollection={activeFilter !== 'trash' ? () => setCreateCollectionOpen(true) : undefined}
          onAddLink={activeFilter !== 'trash' ? () => setAddLinkOpen(true) : undefined}
        />

        {/* Active Tag Filter Indicator */}
        {activeTag && (
          <div className="px-6 py-2 bg-accent/40 border-b border-border/40 flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Filtering by tag:</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent text-foreground font-mono text-[11px] font-medium border border-border/40">
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

        {/* Central Papers Table */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <PaperTable
            papers={filtered}
            collectionMap={collectionMap}
            collections={collections}
            isLoading={isLoading}
            isSearch={Boolean(search.trim()) || Boolean(activeTag) || Boolean(activeFilter)}
            selectedPaperId={selectedPaperId}
            onSelectPaper={handleSelectPaper}
            onDeletePaper={handleDeletePaper}
            onBatchDeletePapers={handleBatchDeletePapers}
            onBatchMovePapers={handleBatchMovePapers}
            onClearSearch={() => {
              setSearch('');
              if (activeTag || activeFilter) navigate(`/${workspaceUrl}/library`);
            }}
            onAddPaper={() => setAddLinkOpen(true)}
            showCollection={activeFilter !== 'unfiled'}
          />
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedPaper || null}
        collection={selectedCollection || null}
        workspaceId={workspaceId}
        onClose={() => setSelectedPaperId(null)}
      />

      {/* Dedicated Add Link to File / Identifier Modal */}
      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingPaper}
      />

      {/* Create Collection Modal */}
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
