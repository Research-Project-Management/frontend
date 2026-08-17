'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import Topbar from '../components/library/layout/topbar';
import PaperTable from '../components/library/table/paper-table';
import InspectorPanel from '../components/library/inspector/inspector-panel';
import { useLibrary } from '../hooks/library/use-library';
import type { Paper } from '../types/library.types';

export default function TrashPage() {
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
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    handleDeletePaper,
  } = actions;

  const trashPapers = React.useMemo(() => {
    return papers
      .filter((p) => Boolean(p.deletedAt))
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
        title="Trash"
        icon={Trash2}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <PaperTable
          papers={trashPapers}
          collectionMap={collectionMap}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim())}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onBatchDeletePapers={actions.handleBatchDeletePapers}
          onClearSearch={() => setSearch('')}
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
    </div>
  );
}
