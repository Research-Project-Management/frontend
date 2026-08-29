'use client';

import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import AddLinkModal from '../components/system/AddLinkModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import { useLibrary } from '../hooks/library/use-library';
import { PaperService } from '../services/paper.service';
import type { Paper } from '../types/library.types';

export default function UnfiledPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
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

  const [search, setSearch] = useState('');

  const { data: viewData, isLoading } = useQuery({
    queryKey: ['papers', workspaceId, 'view', 'unfiled', search],
    queryFn: () =>
      PaperService.getAll(workspaceId, {
        view: 'unfiled',
        search: search.trim() || undefined,
      }),
    enabled: Boolean(workspaceId),
  });

  const unfiledPapers: Paper[] = Array.isArray(viewData?.papers)
    ? viewData.papers
    : [];

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
          title="Unfiled Items"
          icon={Inbox}
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
            papers={unfiledPapers}
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
            showCollection={false}
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

      {/* Add Link Modal */}
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
      />
    </div>
  );
}
