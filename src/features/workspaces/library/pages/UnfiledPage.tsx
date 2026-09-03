'use client';

import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import Topbar from '../components/Topbar';
import ItemTable from '../components/Table';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import { useLibrary } from '../hooks/library/use-library';
import { useViewItems } from '../hooks/library/use-items';
import type { CatalogItem } from '../types/library.types';

export default function UnfiledPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    selectedItemId,
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
  } = actions;

  const [search, setSearch] = useState('');

  const { data: viewData, isLoading } = useViewItems(workspaceId, 'unfiled', search);
  const unfiledItems = Array.isArray(viewData) ? viewData : (viewData as any)?.items || [];

  const handleSelectItem = (item: CatalogItem) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Left Main Content Area (Topbar + Table) */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Unfiled Items"
          icon={Inbox}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={handleDirectFilesUpload}
          onDirectFolderUpload={handleDirectFolderUpload}
          onAddCollection={() => setCreateCollectionOpen(true)}
          onAddLink={() => setAddLinkOpen(true)}
        />

        {/* Central Items Table */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ItemTable
            items={unfiledItems}
            collectionMap={collectionMap}
            collections={collections}
            isLoading={isLoading}
            isSearch={Boolean(search.trim())}
            selectedItemId={selectedItemId}
            onSelectItem={handleSelectItem}
            onDeleteItem={handleDeleteItem}
            onBatchDeleteItems={handleBatchDeleteItems}
            onBatchMoveItems={handleBatchMoveItems}
            onClearSearch={() => setSearch('')}
            showCollection={false}
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

      {/* Add Link Modal */}
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
      />
    </div>
  );
}

