'use client';

import React from 'react';
import { BookOpen, FolderOpen, X, Tag, History, Inbox, Files, Trash2 } from 'lucide-react';
import Topbar from '../components/Topbar';
import ItemTable from '../components/Table';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import { useLibrary } from '../hooks/library/use-library';
import type { CatalogItem, Paper } from '../types/library.types';

export default function LibraryPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    workspaceUrl,
    isLoading,
    search,
    activeTag,
    activeFilter,
    selectedItemId,
    filteredItems,
    selectedItem,
    selectedCollection,
    collectionMap,
    collections,
    addLinkOpen,
    createCollectionOpen,
    isAddingItem,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedItemId,
    setAddLinkOpen,
    handleDirectFilesUpload,
    handleDirectFolderUpload,
    handleAddLinkSubmit,
    setCreateCollectionOpen,
    handleCreateCollection,
    handleDeleteItem,
    handleBatchDeleteItems,
    handleBatchMoveItems,
    navigate,
  } = actions;

  const handleSelectItem = (item: CatalogItem) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
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
    <div className="flex-1 flex overflow-hidden">
      {/* Central Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Workspace Toolbar */}
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

        {/* Active Filter Chips */}
        {(activeTag || activeFilter) && (
          <div className="px-4 py-2 bg-muted/40 border-b border-border/40 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Filtering by:</span>
            {activeTag && (
              <span className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 font-medium">
                Tag: #{activeTag}
              </span>
            )}
            {activeFilter && (
              <span className="px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground border border-border/50 font-medium capitalize">
                View: {activeFilter}
              </span>
            )}
            <button
              onClick={() => navigate(`/${workspaceUrl}/library`)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline transition-colors focus:outline-none"
            >
              <span>Clear filter</span>
              <X className="size-3 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}

        {/* Central Items Table */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ItemTable
            items={filteredItems}
            collectionMap={collectionMap}
            collections={collections}
            isLoading={isLoading}
            isSearch={Boolean(search.trim()) || Boolean(activeTag) || Boolean(activeFilter)}
            selectedItemId={selectedItemId}
            onSelectItem={handleSelectItem}
            onDeleteItem={handleDeleteItem}
            onBatchDeleteItems={handleBatchDeleteItems}
            onBatchMoveItems={handleBatchMoveItems}
            onClearSearch={() => {
              setSearch('');
              if (activeTag || activeFilter) navigate(`/${workspaceUrl}/library`);
            }}
            onAddItem={() => setAddLinkOpen(true)}
            showCollection={activeFilter !== 'unfiled'}
          />
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedItem || null}
        item={selectedItem || null}
        collection={selectedCollection || null}
        workspaceId={workspaceId}
        onClose={() => setSelectedItemId(null)}
      />

      {/* Dedicated Add Link to File / Identifier Modal */}
      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingItem}
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

