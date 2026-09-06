'use client';

import React, { useState } from 'react';
import {
  Trash2,
  RotateCcw,
  Loader2,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import BatchBar from '../components/table/BatchBar';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
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
import { useLibrary } from '../hooks/use-library';
import { useTrash, useItemTable, type SortField } from '../hooks/use-items';
import { normalizeAuthors, formatCreatorCompact } from '../utils/library.util';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '../types/library.types';

export default function TrashPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    selectedItemId,
    selectedItem,
    selectedCollection,
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

  const {
    sortedItems,
    sortField,
    sortOrder,
    handleSort,
    selectedIds,
    isAllSelected,
    isPartiallySelected,
    toggleSelectAll,
    toggleSelect,
    clearSelection,
  } = useItemTable({
    items: filteredTrashItems,
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
  });

  const handleSelectItem = (item: CatalogItem) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const handleRowClick = (e: React.MouseEvent, item: CatalogItem) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    handleSelectItem(item);
  };

  const handleRestoreItem = async (itemId: string) => {
    await restoreItem(itemId);
  };

  const handlePurgeItem = async (itemId: string) => {
    await purgeItem(itemId);
    setSinglePurgeTarget(null);
  };

  const handleBatchRestoreItems = async () => {
    if (selectedIds.size === 0) return;
    await Promise.all(Array.from(selectedIds).map((id) => restoreItem(id)));
    clearSelection();
  };

  const handleBatchPurgeItems = async () => {
    if (selectedIds.size === 0) return;
    await Promise.all(Array.from(selectedIds).map((id) => purgeItem(id)));
    clearSelection();
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

  const [hasUserSorted, setHasUserSorted] = useState(false);

  const onColumnSort = (field: SortField) => {
    setHasUserSorted(true);
    handleSort(field);
  };

  const renderSortIcon = (field: SortField) => {
    if (!hasUserSorted || sortField !== field) return null;
    return (
      <span className="shrink-0 ml-1.5 inline-flex items-center text-foreground">
        {sortOrder === 'desc' ? (
          <ArrowDown className="size-3.5 text-foreground" />
        ) : (
          <ArrowUp className="size-3.5 text-foreground" />
        )}
      </span>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden font-sans">
      {/* Left Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Trash"
          icon={Trash2}
          search={search}
          onSearchChange={setSearch}
        >
          {trashItems.length > 0 && (
            <div className="flex items-center gap-2">
              <Tooltip>
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
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background">
          {isLoading && trashItems.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/40">
                  <Skeleton className="size-4 rounded-md" />
                  <Skeleton className="h-4 flex-1 max-w-[360px]" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : filteredTrashItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[300px] text-center p-8 select-none">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Trash2 className="size-6 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Trash is empty</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search.trim()
                  ? 'No deleted references matching your search query.'
                  : 'Items moved to trash will appear here. You can restore them or permanently delete them.'}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-3 rounded-sm px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-6/12" />
                  <col className="w-6/12" />
                  <col className="w-10" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-xs select-none border-b border-border/60">
                  <tr className="h-9 type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground">
                    <th className="w-10 px-2.5 py-1.5 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all items"
                        />
                      </div>
                    </th>
                    <th
                      onClick={() => onColumnSort('title')}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer min-w-0 truncate"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Title</span>
                        {renderSortIcon('title')}
                      </div>
                    </th>
                    <th
                      onClick={() => onColumnSort('authors')}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer truncate"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Creator</span>
                        {renderSortIcon('authors')}
                      </div>
                    </th>
                    <th className="w-10 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sortedItems.map((paper) => {
                    const isSelected = selectedIds.has(paper.id);
                    const isActive = selectedItemId === paper.id;
                    const authors = normalizeAuthors(paper.authors, (paper as any).creators, (paper as any).contributors);
                    const authorCompact = formatCreatorCompact(authors);
                    const authorFull = authors.length > 0 ? authors.join('; ') : '—';

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            onClick={(e) => handleRowClick(e, paper)}
                            className={cn(
                              'group h-9 transition-colors cursor-pointer border-b border-border/30',
                              isSelected ? 'bg-muted/80' : isActive ? 'bg-muted/50' : 'hover:bg-muted/30',
                            )}
                          >
                            <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(paper.id)}
                                  aria-label={`Select ${paper.title || 'reference'}`}
                                />
                              </div>
                            </td>

                            <td className="px-3.5 py-1.5 align-middle min-w-0 max-w-0 truncate">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="truncate block type-dense font-normal text-foreground"
                                  title={paper.title || 'Untitled Reference'}
                                >
                                  {paper.title || 'Untitled Reference'}
                                </span>
                              </div>
                            </td>

                            <td className="px-3.5 py-1.5 align-middle max-w-0 truncate">
                              <span
                                className="truncate block type-dense font-normal text-foreground"
                                title={authorFull}
                              >
                                {authorCompact}
                              </span>
                            </td>

                            <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer outline-none touch-manipulation"
                                      aria-label="More actions"
                                    >
                                      <MoreVertical className="size-4 text-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} className="w-48 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                                    <DropdownMenuItem
                                      onClick={() => handleRestoreItem(paper.id)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                                    >
                                      <RotateCcw className="size-3.5 text-foreground shrink-0" />
                                      <span>Restore to Library</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setSinglePurgeTarget(paper)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                                    >
                                      <Trash2 className="size-3.5 text-foreground shrink-0" />
                                      <span>Delete Permanently</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 text-xs font-sans">
                          <ContextMenuItem onClick={() => handleRestoreItem(paper.id)} className="gap-2 cursor-pointer text-foreground">
                            <RotateCcw className="size-3.5 text-foreground" />
                            <span>Restore to Library</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => setSinglePurgeTarget(paper)} className="gap-2 cursor-pointer text-foreground">
                            <Trash2 className="size-3.5 text-foreground" />
                            <span>Delete Permanently</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Floating Dedicated Trash Batch Bar */}
          <BatchBar
            isTrash={true}
            selectedCount={selectedIds.size}
            selectedItems={sortedItems.filter((i) => selectedIds.has(i.id))}
            collections={[]}
            onClearSelection={clearSelection}
            onBatchRestore={handleBatchRestoreItems}
            onBatchDelete={handleBatchPurgeItems}
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
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <Trash2 className="h-5 w-5 text-foreground" />
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
              className="bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-none !rounded-md"
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
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <Trash2 className="h-5 w-5 text-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Permanently delete reference?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to permanently delete &ldquo;{singlePurgeTarget?.title || 'Untitled Reference'}&rdquo;?
                This action cannot be undone and any associated files will be removed.
              </DialogDescription>
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
              className="bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-none !rounded-md"
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
