'use client';

import React from 'react';
import { History } from 'lucide-react';
import Topbar from '../components/library/layout/topbar';
import PaperTable from '../components/library/table/paper-table';
import InspectorPanel from '../components/library/inspector/inspector-panel';
import UploadModal from '../components/library/modals/upload-modal';
import CreateCollectionModal from '../components/library/modals/create-collection-modal';
import { useLibrary } from '../hooks/library/use-library';
import type { Paper } from '../types/library.types';

export default function RecentlyReadPage() {
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
    createCollectionOpen,
    isAddingPaper,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    setUploadOpen,
    setCreateCollectionOpen,
    handleAddPaper,
    handleCreateCollection,
    handleDeletePaper,
  } = actions;

  const recentlyReadPapers = React.useMemo(() => {
    const nonDeleted = papers.filter((p) => !p.deletedAt);
    const read = nonDeleted.filter((p) => Boolean(p.accessedAt));
    const list = read.length > 0
      ? read.sort((a, b) => new Date(b.accessedAt || 0).getTime() - new Date(a.accessedAt || 0).getTime())
      : [...nonDeleted].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q))
    );
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
        title="Recently Read"
        icon={History}
        search={search}
        onSearchChange={setSearch}
        onAddPaper={() => setUploadOpen(true)}
        onAddCollection={() => setCreateCollectionOpen(true)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <PaperTable
          papers={recentlyReadPapers}
          collectionMap={collectionMap}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim())}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onClearSearch={() => setSearch('')}
          onAddPaper={() => setUploadOpen(true)}
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
