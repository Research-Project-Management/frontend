'use client';

import React, { useState } from 'react';
import { Files, GitMerge, ShieldCheck } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import UploadModal from '../components/system/UploadModal';
import CreateCollectionModal from '../components/system/CreateCollectionModal';
import MergeDialog from '../components/duplicates/MergeDialog';
import { useLibrary } from '../hooks/library/use-library';
import { useDuplicateGroups, useMergePapers, useLibraryIntegrity } from '../hooks/use-library';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { Paper, DuplicateGroup } from '../types/library.types';

export default function DuplicatesPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
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
    uploadMode,
  } = state;

  const {
    setSearch,
    setSelectedPaperId,
    setUploadOpen,
    setCreateCollectionOpen,
    handleAddPaper,
    handleCreateCollection,
    handleDeletePaper,
    handleBatchDeletePapers,
    handleBatchMovePapers,
    handleOpenUpload,
  } = actions;

  const { data: duplicateData, isLoading: isDupLoading } = useDuplicateGroups(workspaceId);
  const { data: integrityData } = useLibraryIntegrity(workspaceId);
  const mergeMutation = useMergePapers(workspaceId);

  const [mergingCluster, setMergingCluster] = useState<Paper[] | null>(null);

  const duplicateGroups: DuplicateGroup[] = duplicateData?.duplicateGroups || [];
  const allDuplicatePapers: Paper[] = duplicateGroups.flatMap((g) => g.papers);

  const filteredPapers = React.useMemo(() => {
    if (!search.trim()) return allDuplicatePapers;
    const q = search.toLowerCase();
    return allDuplicatePapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (Array.isArray(p.authors) && p.authors.some((a) => a.toLowerCase().includes(q))) ||
        (p.doi && p.doi.toLowerCase().includes(q)),
    );
  }, [allDuplicatePapers, search]);

  const handleSelectPaper = (paper: Paper) => {
    const paperId = paper.id;
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
    }
  };

  const handleExecuteMerge = async (
    masterPaper: Paper,
    _mergedFields: Partial<Paper>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      masterPaperId: masterPaper.id,
      sourcePaperIds: duplicateIdsToDelete,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-background overflow-hidden relative">
      <Topbar
        search={search}
        onSearchChange={setSearch}
      />

      {/* Duplicate detection summary bar */}
      <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
          <Files className="size-4 shrink-0" />
          <span>
            Found <strong>{duplicateGroups.length}</strong> duplicate clusters ({allDuplicatePapers.length} duplicate records)
          </span>
          {integrityData?.healthScorePercentage != null && (
            <Badge variant="outline" className="ml-2 text-[10px] bg-background/50 border-amber-500/30">
              Library Health: {integrityData.healthScorePercentage}%
            </Badge>
          )}
        </div>

        {duplicateGroups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
            {duplicateGroups.map((grp, idx) => (
              <Button
                key={idx}
                size="sm"
                variant="outline"
                onClick={() => setMergingCluster(grp.papers)}
                className="h-7 text-xs gap-1.5 bg-background shadow-xs hover:bg-amber-500/20 border-amber-500/30 cursor-pointer"
              >
                <GitMerge className="size-3 text-amber-500" />
                <span className="truncate max-w-28">{grp.papers[0]?.title || `Group #${idx + 1}`}</span>
                <Badge variant="secondary" className="px-1 py-0 text-[9px] h-4">
                  {grp.papers.length}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {duplicateGroups.length === 0 && !isDupLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Library is 100% Clean!
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                No duplicate papers found by DOI or Title/Author/Year.
              </p>
            </div>
          ) : (
            <PaperTable
              papers={filteredPapers}
              isLoading={isDupLoading}
              isSearch={Boolean(search.trim())}
              selectedPaperId={selectedPaperId}
              onSelectPaper={handleSelectPaper}
              onDeletePaper={handleDeletePaper}
              onBatchDeletePapers={handleBatchDeletePapers}
              onBatchMovePapers={handleBatchMovePapers}
              onClearSearch={() => setSearch('')}
              onAddPaper={() => setUploadOpen(true)}
              collectionMap={collectionMap}
              collections={collections}
            />
          )}
        </div>

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

      {mergingCluster && (
        <MergeDialog
          open={Boolean(mergingCluster)}
          onOpenChange={(open) => !open && setMergingCluster(null)}
          duplicates={mergingCluster}
          onMerge={handleExecuteMerge}
        />
      )}
    </div>
  );
}
