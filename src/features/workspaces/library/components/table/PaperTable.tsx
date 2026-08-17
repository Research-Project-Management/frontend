'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui';
import PaperTableHeader from './PaperTableHeader';
import PaperTableRow from './PaperTableRow';
import PaperTableEmpty from './PaperTableEmpty';
import PaperBatchBar from './PaperBatchBar';
import { usePaper, type SortField, type SortOrder } from '../../hooks/library/use-paper';
import type { Paper, Collection } from '../../types/library.types';

interface PaperTableProps {
  papers: Paper[];
  collectionMap?: Record<string, Collection>;
  collections?: Collection[];
  isLoading: boolean;
  isSearch: boolean;
  selectedPaperId: string | null;
  onSelectPaper: (paper: Paper) => void;
  onDeletePaper: (id: string) => void;
  onBatchDeletePapers?: (ids: string[]) => void;
  onBatchMovePapers?: (ids: string[], targetCollectionId: string | null) => void;
  onClearSearch?: () => void;
  onAddPaper?: () => void;
  collectionName?: string;
  showCollection?: boolean;
}

export default function PaperTable({
  papers,
  collectionMap = {},
  collections = [],
  isLoading,
  isSearch,
  selectedPaperId,
  onSelectPaper,
  onDeletePaper,
  onBatchDeletePapers,
  onBatchMovePapers,
  onClearSearch,
  onAddPaper,
  collectionName,
  showCollection = true,
}: PaperTableProps) {
  const {
    sortedPapers,
    sortField,
    sortOrder,
    handleSort,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    isPartiallySelected,
    selectedCount,
  } = usePaper({ papers, initialActiveId: selectedPaperId });

  // Selected paper objects for batch actions
  const selectedPapers = React.useMemo(() => {
    return papers.filter((p) => selectedIds.has(p._id));
  }, [papers, selectedIds]);

  const handleBatchDelete = () => {
    if (!confirm(`Delete ${selectedCount} selected papers?`)) return;
    if (onBatchDeletePapers) {
      onBatchDeletePapers(Array.from(selectedIds));
    } else {
      for (const id of selectedIds) {
        onDeletePaper(id);
      }
    }
    clearSelection();
  };

  const handleBatchMove = (targetCollectionId: string | null) => {
    if (onBatchMovePapers) {
      onBatchMovePapers(Array.from(selectedIds), targetCollectionId);
    }
    clearSelection();
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <div className="h-9 w-full bg-muted/60 rounded-md animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <PaperTableEmpty
        isSearch={isSearch}
        onClearSearch={onClearSearch}
        collectionName={collectionName}
      />
    );
  }

  return (
    <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto min-w-0 select-none">
      <table className="w-full text-left border-collapse select-none">
        <PaperTableHeader
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          isAllSelected={isAllSelected}
          isPartiallySelected={isPartiallySelected}
          onToggleSelectAll={toggleSelectAll}
          showCollection={showCollection}
        />

        <tbody className="divide-y divide-border/30">
          {sortedPapers.map((paper: Paper) => (
            <PaperTableRow
              key={paper._id}
              paper={paper}
              collection={paper.collectionId ? collectionMap[paper.collectionId] ?? null : null}
              isSelected={selectedIds.has(paper._id)}
              isActive={selectedPaperId === paper._id}
              onSelect={onSelectPaper}
              onToggleCheck={toggleSelect}
              onDelete={onDeletePaper}
              showCollection={showCollection}
            />
          ))}
        </tbody>
      </table>

      {/* Floating Batch Action Bar */}
      <PaperBatchBar
        selectedCount={selectedCount}
        selectedPapers={selectedPapers}
        collections={collections}
        onClearSelection={clearSelection}
        onBatchMove={handleBatchMove}
        onBatchDelete={handleBatchDelete}
      />
    </div>
  );
}
