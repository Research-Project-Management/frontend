'use client';

import React, { useState, useMemo } from 'react';
import { Trash2, RotateCcw, ShieldAlert } from 'lucide-react';
import Topbar from '../components/topbar/Topbar';
import PaperTable from '../components/table/PaperTable';
import InspectorPanel from '../components/panel/Panel';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui';
import { toast } from 'sonner';
import { useLibrary } from '../hooks/library/use-library';
import { usePapers } from '../hooks/data/use-papers';
import { getLibraryEntityId } from '../utils/library.util';
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
    handleBatchDeletePapers,
  } = actions;

  const paperDataService = usePapers({ workspaceId });
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const trashPapers = useMemo(() => {
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
    const paperId = getLibraryEntityId(paper);
    if (selectedPaperId === paperId) {
      setSelectedPaperId(null);
    } else {
      setSelectedPaperId(paperId);
    }
  };

  const handleRestorePaper = async (paperId: string) => {
    try {
      await paperDataService.actions.updatePaper({ paperId, deletedAt: null });
      toast.success('Paper restored to library successfully', { id: 'restore-success' });
      await paperDataService.actions.refetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore paper', { id: 'restore-error' });
    }
  };

  const handleRestoreAll = async () => {
    try {
      for (const p of trashPapers) {
        const id = getLibraryEntityId(p);
        await paperDataService.actions.updatePaper({ paperId: id, deletedAt: null });
      }
      toast.success(`Restored ${trashPapers.length} papers to library`, { id: 'restore-all' });
      await paperDataService.actions.refetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore all papers', { id: 'restore-error' });
    }
  };

  const handleConfirmEmptyTrash = async () => {
    try {
      setIsPurging(true);
      for (const p of trashPapers) {
        const id = getLibraryEntityId(p);
        await paperDataService.actions.deletePaper({ paperId: id });
      }
      toast.success('Trash emptied successfully', { id: 'trash-empty' });
      setEmptyTrashDialogOpen(false);
      await paperDataService.actions.refetchAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to empty trash', { id: 'trash-empty-error' });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0 flex-1 overflow-hidden">
      <Topbar
        title="Trash"
        icon={Trash2}
        search={search}
        onSearchChange={setSearch}
      >
        {trashPapers.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestoreAll}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
            >
              <RotateCcw className="size-3.5" />
              <span>Restore All</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setEmptyTrashDialogOpen(true)}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
            >
              <Trash2 className="size-3.5" />
              <span>Empty Trash</span>
            </Button>
          </div>
        )}
      </Topbar>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Central Papers Table */}
        <PaperTable
          papers={trashPapers}
          collectionMap={collectionMap}
          collections={collections}
          isLoading={isLoading}
          isSearch={Boolean(search.trim())}
          selectedPaperId={selectedPaperId}
          onSelectPaper={handleSelectPaper}
          onDeletePaper={handleDeletePaper}
          onBatchDeletePapers={handleBatchDeletePapers}
          onClearSearch={() => setSearch('')}
          showCollection={true}
        />

        {/* Right Inspector Panel */}
        {selectedPaper && (
          <InspectorPanel
            paper={selectedPaper}
            collection={selectedCollection}
            workspaceId={workspaceId}
            onClose={() => setSelectedPaperId(null)}
          />
        )}
      </div>

      {/* Empty Trash Confirmation Dialog */}
      <Dialog open={emptyTrashDialogOpen} onOpenChange={setEmptyTrashDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              <DialogTitle>Permanently Empty Trash?</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to permanently delete all {trashPapers.length} items from the trash? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEmptyTrashDialogOpen(false)} disabled={isPurging}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmEmptyTrash} disabled={isPurging}>
              {isPurging ? 'Purging...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
