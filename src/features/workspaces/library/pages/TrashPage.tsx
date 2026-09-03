'use client';

import React, { useState } from 'react';
import { Trash2, RotateCcw, Loader2 } from 'lucide-react';
import Topbar from '../components/Topbar';
import ItemTable from '../components/Table';
import InspectorPanel from '../components/Panel';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { useLibrary } from '../hooks/library/use-library';
import { useTrash } from '../hooks/library/use-items';
import type { CatalogItem } from '../types/library.types';

export default function TrashPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    selectedItemId,
    selectedItem,
    selectedCollection,
    collectionMap,
    collections,
  } = state;

  const { setSelectedItemId } = actions;

  const [search, setSearch] = useState('');
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [singlePurgeTarget, setSinglePurgeTarget] = useState<CatalogItem | null>(null);

  const {
    trashItems,
    isLoading,
    restoreItem,
    purgeItem,
    emptyTrash,
    isPurging,
    isEmptyingTrash,
  } = useTrash(workspaceId);

  const filteredTrashItems = search.trim()
    ? trashItems.filter((item) =>
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.authors?.some((a) => a.toLowerCase().includes(search.toLowerCase())),
      )
    : trashItems;

  const handleSelectItem = (item: CatalogItem) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const handleRestoreItem = async (itemId: string) => {
    await restoreItem(itemId);
  };

  const handlePurgeItem = async (itemId: string) => {
    await purgeItem(itemId);
    setSinglePurgeTarget(null);
  };

  const handleBatchRestoreItems = async (ids: string[]) => {
    await Promise.all(ids.map((id) => restoreItem(id)));
  };

  const handleBatchPurgeItems = async (ids: string[]) => {
    await Promise.all(ids.map((id) => purgeItem(id)));
  };

  const handleConfirmEmptyTrash = async () => {
    if (trashItems.length === 0) return;
    try {
      await emptyTrash();
      setEmptyTrashDialogOpen(false);
    } catch {
      // Handled in useTrash hook
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Left Main Content Area (Topbar + Table) */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Trash"
          icon={Trash2}
          search={search}
          onSearchChange={setSearch}
        >
          {trashItems.length > 0 && (
            <div className="flex items-center gap-2">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEmptyTrashDialogOpen(true)}
                    className="h-8 text-xs gap-1.5 px-3 cursor-pointer font-medium text-foreground hover:bg-muted border border-border/80 !rounded-md shadow-none"
                  >
                    <Trash2 className="size-3.5 text-foreground" />
                    <span>Empty Trash</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-normal px-2 py-0.5 rounded-md shadow-sm border border-border/80 bg-popover text-foreground">
                  Permanently delete all items from trash
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </Topbar>

        {/* Central Items Table */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ItemTable
            items={filteredTrashItems}
            collectionMap={collectionMap}
            collections={collections}
            isLoading={isLoading}
            isSearch={Boolean(search.trim())}
            selectedItemId={selectedItemId}
            onSelectItem={handleSelectItem}
            onRestoreItem={handleRestoreItem}
            onPurgeItem={(id) => {
              const target = trashItems.find((i) => i.id === id);
              if (target) setSinglePurgeTarget(target);
              else handlePurgeItem(id);
            }}
            onBatchRestoreItems={handleBatchRestoreItems}
            onBatchPurgeItems={handleBatchPurgeItems}
            onClearSearch={() => setSearch('')}
            showCollection={true}
            isTrash={true}
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

      {/* Empty Trash Confirmation Dialog */}
      <Dialog open={emptyTrashDialogOpen} onOpenChange={isPurging || isEmptyingTrash ? undefined : setEmptyTrashDialogOpen}>
        <DialogContent
          className="max-w-[520px] p-6 !rounded-md"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Permanently empty trash?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to permanently delete all {trashItems.length} items from the trash? This action cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-6 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmptyTrashDialogOpen(false)}
              disabled={isPurging || isEmptyingTrash}
              className="cursor-pointer !rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEmptyTrash}
              disabled={isPurging || isEmptyingTrash}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-none !rounded-md"
            >
              {isPurging || isEmptyingTrash ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Purging...</span>
                </span>
              ) : (
                <span>Delete Permanently</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Item Purge Confirmation Dialog */}
      <Dialog open={Boolean(singlePurgeTarget)} onOpenChange={(open) => !open && setSinglePurgeTarget(null)}>
        <DialogContent
          className="max-w-[520px] p-6 !rounded-md"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Permanently delete item?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to permanently delete this item? This action cannot be undone.
              </DialogDescription>

              {singlePurgeTarget?.title && (
                <div className="mt-3 px-3 py-2 rounded-md bg-muted/40 border border-border/50 text-xs text-foreground truncate font-normal leading-relaxed">
                  {singlePurgeTarget.title}
                </div>
              )}
            </div>
          </DialogHeader>

          <DialogFooter className="mt-6 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSinglePurgeTarget(null)}
              disabled={isPurging}
              className="cursor-pointer !rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => singlePurgeTarget && handlePurgeItem(singlePurgeTarget.id)}
              disabled={isPurging}
              className="bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-none !rounded-md"
            >
              {isPurging ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </span>
              ) : (
                <span>Delete Permanently</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

