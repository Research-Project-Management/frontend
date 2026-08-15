'use client';

import React from 'react';
import { Files } from 'lucide-react';
import Topbar from '../components/library/layout/topbar';
import PaperTable from '../components/library/table/paper-table';
import InspectorPanel from '../components/library/inspector/inspector-panel';
import UploadModal from '../components/library/modals/upload-modal';
import CreateCollectionModal from '../components/library/modals/create-collection-modal';
import { useLibrary } from '../hooks/library/use-library';
import type { Paper } from '../types/library.types';

export default function DuplicatesPage() {
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

  const duplicatePapers = React.useMemo(() => {
    const doiMap = new Map<string, string[]>();
    const titleMap = new Map<string, string[]>();

    for (const p of papers) {
      if (p.deletedAt) continue;
      if (p.doi && p.doi.trim()) {
        const d = p.doi.trim().toLowerCase();
        doiMap.set(d, [...(doiMap.get(d) || []), p._id]);
      }
      if (p.title && p.title.trim()) {
        const t = p.title.trim().toLowerCase();
        titleMap.set(t, [...(titleMap.get(t) || []), p._id]);
      }
    }

    const dupIds = new Set<string>();
    for (const ids of doiMap.values()) {
      if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
    }
    for (const ids of titleMap.values()) {
      if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
    }

    return papers
      .filter((p) => dupIds.has(p._id))
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
        title="Duplicate Items"
        icon={Files}
        search={search}
        onSearchChange={setSearch}
        onAddPaper={() => setUploadOpen(true)}
        onAddCollection={() => setCreateCollectionOpen(true)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <PaperTable
          papers={duplicatePapers}
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
