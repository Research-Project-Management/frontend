'use client';

import React from 'react';
import { Folder } from 'lucide-react';
import Topbar, { type BreadcrumbItem } from '../layout/topbar';
import PaperTable from '../table/paper-table';
import InspectorPanel from '../inspector/inspector-panel';
import UploadModal from '../modals/upload-modal';
import CreateCollectionModal from '../modals/create-collection-modal';
import { useCollection } from '../../../hooks/library/use-collection';
import type { Paper } from '../../../types/library.types';

export default function CollectionView() {
  const { state, actions } = useCollection();
  const {
    workspaceId,
    workspaceUrl,
    isLoading,
    collection,
    papers,
    search,
    selectedPaperId,
    selectedPaper,
    filtered,
    uploadOpen,
    subCreateOpen,
    visibleBreadcrumbs,
    collections,
    isAddingPaper,
    isCreatingSub,
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    setUploadOpen,
    setSubCreateOpen,
    handleAddPaper,
    handleDeletePaper,
    handleCreateSub,
    navigate,
  } = actions;

  const handleSelectPaper = (paper: Paper) => {
    if (selectedPaperId === paper._id) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paper._id);
    }
  };

  const breadcrumbs: BreadcrumbItem[] = (visibleBreadcrumbs || []).map((bc) => ({
    _id: bc.id,
    name: bc.name,
    color: bc.color,
  }));

  return (
    <div className="flex flex-col h-full min-w-0 flex-1 overflow-hidden">
      <Topbar
        title={collection?.name ?? 'Collection'}
        icon={Folder}
        search={search}
        onSearchChange={setSearch}
        onAddPaper={() => setUploadOpen(true)}
        onAddCollection={() => setSubCreateOpen(true)}
        breadcrumbs={breadcrumbs.length > 0 ? breadcrumbs : undefined}
        onNavigateCrumb={(id) => navigate(`/${workspaceUrl}/library/${id}`)}
        isSubcollection={Boolean(collection?.parent)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Central Papers Table */}
        <PaperTable
          papers={filtered}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim())}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onClearSearch={() => setSearch('')}
          onAddPaper={() => setUploadOpen(true)}
          collectionName={collection?.name}
          showCollection={false}
        />

        {/* Right Inspector Panel */}
        {selectedPaper && (
          <InspectorPanel
            paper={selectedPaper}
            collection={collection}
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
        open={subCreateOpen}
        onOpenChange={setSubCreateOpen}
        onSubmit={handleCreateSub}
        isPending={isCreatingSub}
        collections={collections}
        defaultParentId={collection?._id}
      />
    </div>
  );
}
