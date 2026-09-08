'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  FolderOpen,
  X,
  History,
  Inbox,
  Files,
  Trash2,
  Quote,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import TrashModal, { type MoveToTrashTarget } from '../components/modals/TrashModal';
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
import { useLibrary } from '../hooks/use-library';
import { useItemTable, type SortField } from '../hooks/use-items';
import { normalizeAuthors, formatCreatorCompact } from '../utils/library.util';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '../types/library.types';

export default function LibraryPage() {
  const router = useRouter();
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    workspaceSlug,
    isLoading,
    search,
    activeTag,
    activeFilter,
    selectedItemId,
    filteredItems,
    selectedItem,
    selectedCollection,
    collectionMap,
    collections,
    addLinkOpen,
    createCollectionOpen,
    isAddingItem,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedItemId,
    setAddLinkOpen,
    handleDirectFilesUpload,
    handleDirectFolderUpload,
    handleAddLinkSubmit,
    setCreateCollectionOpen,
    handleCreateCollection,
    handleDeleteItem,
    handleBatchDeleteItems,
    handleBatchMoveItems,
    navigate,
  } = actions;

  const [trashTarget, setTrashTarget] = useState<MoveToTrashTarget | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

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
    items: filteredItems,
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

  const handleCloseInspector = useCallback(() => {
    setSelectedItemId(null);
  }, [setSelectedItemId]);

  const handleRowClick = (e: React.MouseEvent, item: CatalogItem) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    handleSelectItem(item);
  };

  const handleRowDoubleClick = (e: React.MouseEvent, item: CatalogItem) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    if (item.id && workspaceId) {
      router.push(`/${workspaceId}/library/papers/${item.id}`);
    }
  };

  const handleInitiateSingleTrash = (item: CatalogItem) => {
    setTrashTarget({
      id: item.id,
      title: item.title || 'Untitled Reference',
    });
    setIsTrashOpen(true);
  };

  const handleInitiateBatchTrash = () => {
    if (selectedIds.size === 0) return;
    setTrashTarget({
      ids: Array.from(selectedIds),
    });
    setIsTrashOpen(true);
  };

  const handleConfirmTrash = () => {
    if (!trashTarget) return;
    if (trashTarget.ids && trashTarget.ids.length > 0) {
      handleBatchDeleteItems?.(trashTarget.ids);
      clearSelection();
    } else if (trashTarget.id) {
      handleDeleteItem?.(trashTarget.id);
      if (selectedIds.has(trashTarget.id)) {
        clearSelection();
      }
    }
    setIsTrashOpen(false);
    setTrashTarget(null);
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

  const getPageInfo = () => {
    if (selectedCollection) {
      return { title: selectedCollection.name, icon: FolderOpen };
    }
    switch (activeFilter) {
      case 'recent-read':
        return { title: 'Recently Read', icon: History };
      case 'unfiled':
        return { title: 'Unfiled Items', icon: Inbox };
      case 'duplicates':
        return { title: 'Duplicate Items', icon: Files };
      case 'trash':
        return { title: 'Trash', icon: Trash2 };
      default:
        return { title: 'Library', icon: BookOpen };
    }
  };

  const { title: pageTitle, icon: PageIcon } = getPageInfo();

  return (
    <div className="flex-1 flex overflow-hidden font-sans">
      {/* Central Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Workspace Toolbar */}
        <Topbar
          title={pageTitle}
          icon={PageIcon}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={activeFilter !== 'trash' ? handleDirectFilesUpload : undefined}
          onDirectFolderUpload={activeFilter !== 'trash' ? handleDirectFolderUpload : undefined}
          onAddCollection={activeFilter !== 'trash' ? () => setCreateCollectionOpen(true) : undefined}
          onAddLink={activeFilter !== 'trash' ? () => setAddLinkOpen(true) : undefined}
        />

        {/* Active Filter Chips */}
        {(activeTag || activeFilter) && (
          <div className="px-4 py-2 bg-muted/40 border-b border-border/40 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Filtering by:</span>
            {activeTag && (
              <span className="px-2 py-0.5 rounded-sm bg-muted text-foreground border border-border/50 font-medium">
                Tag: #{activeTag}
              </span>
            )}
            {activeFilter && (
              <span className="px-2 py-0.5 rounded-sm bg-muted text-foreground border border-border/50 font-medium capitalize">
                View: {activeFilter}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate(`/${workspaceSlug}/library`)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:bg-muted rounded-sm px-1.5 py-0.5 transition-colors focus:outline-none cursor-pointer"
            >
              <span>Clear filter</span>
              <X className="size-3 text-muted-foreground shrink-0" />
            </button>
          </div>
        )}

        {/* Central Items Table - Managed Directly by LibraryPage */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background">
          {isLoading && filteredItems.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, skeletonIndex) => (
                <div key={skeletonIndex} className="flex items-center gap-3 py-2 border-b border-border/40">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-4 flex-1 max-w-[320px]" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[300px] text-center p-8 select-none">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <BookOpen className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No references found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search.trim()
                  ? 'No references matching your search query.'
                  : 'Add references, PDFs, or BibTeX entries to build your research library.'}
              </p>
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-3 text-xs text-foreground hover:bg-muted rounded-sm px-1.5 py-0.5 cursor-pointer font-medium"
                >
                  Clear search
                </button>
              ) : (
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddLinkOpen(true)}
                    className="h-8 text-xs gap-1.5 cursor-pointer text-foreground hover:bg-muted border border-border/80 !rounded-md shadow-none"
                  >
                    <span>Add Item</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-10" />
                  <col className={activeFilter === 'unfiled' ? 'w-5/12' : 'w-4/12'} />
                  <col className={activeFilter === 'unfiled' ? 'w-4/12' : 'w-3/12'} />
                  <col className="w-[70px]" />
                  {activeFilter !== 'unfiled' && (
                    <col className="w-3/12" />
                  )}
                  <col className={activeFilter === 'unfiled' ? 'w-[120px]' : 'w-[110px]'} />
                  <col className="w-10" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-xs border-b border-border/60 select-none">
                  <tr className="h-9 type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground">
                    <th className="w-10 px-2.5 py-1.5 text-center align-middle">
                      <Checkbox
                        checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
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
                    <th
                      onClick={() => onColumnSort('year')}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer whitespace-nowrap"
                    >
                      <div className="flex items-center">
                        <span className="whitespace-nowrap">Year</span>
                        {renderSortIcon('year')}
                      </div>
                    </th>
                    {activeFilter !== 'unfiled' && (
                      <th className="px-3.5 py-1.5 align-middle truncate">
                        <span className="truncate">Collection</span>
                      </th>
                    )}
                    <th
                      onClick={() => onColumnSort('createdAt')}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer whitespace-nowrap"
                    >
                      <div className="flex items-center">
                        <span className="whitespace-nowrap">Date Added</span>
                        {renderSortIcon('createdAt')}
                      </div>
                    </th>
                    <th className="w-10 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sortedItems.map((paper) => {
                    const isSelected = selectedIds.has(paper.id);
                    const isActive = selectedItemId === paper.id;
                    const authors = normalizeAuthors(paper.authors, paper.creators, paper.contributors);
                    const authorCompact = formatCreatorCompact(authors);
                    const authorFull = authors.length > 0 ? authors.join('; ') : '—';
                    const collection = paper.collectionId ? collectionMap[paper.collectionId] : null;

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            onClick={(clickEvent) => handleRowClick(clickEvent, paper)}
                            onDoubleClick={(clickEvent) => handleRowDoubleClick(clickEvent, paper)}
                            className={cn(
                              'group h-9 transition-colors cursor-pointer border-b border-border/30',
                              isSelected ? 'bg-muted/80' : isActive ? 'bg-muted/50' : 'hover:bg-muted/30',
                            )}
                          >
                            <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(paper.id)}
                                aria-label={`Select ${paper.title || 'reference'}`}
                              />
                            </td>

                            <td className="px-3.5 py-1.5 align-middle min-w-0 max-w-0 truncate">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate block type-dense font-normal text-foreground" title={paper.title || 'Untitled Reference'}>
                                  {paper.title || 'Untitled Reference'}
                                </span>
                              </div>
                            </td>

                            <td className="px-3.5 py-1.5 align-middle max-w-0 truncate">
                              <span className="truncate block type-dense font-normal text-foreground" title={authorFull}>
                                {authorCompact}
                              </span>
                            </td>

                            <td className="px-3.5 py-1.5 align-middle type-dense font-normal text-foreground tabular-nums truncate">
                              {paper.year || '—'}
                            </td>

                            {activeFilter !== 'unfiled' && (
                              <td className="px-3.5 py-1.5 align-middle type-dense font-normal text-foreground truncate">
                                {collection?.name || '—'}
                              </td>
                            )}

                            <td className="px-3.5 py-1.5 align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap">
                              {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString('en-US') : '—'}
                            </td>

                            <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                              <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer outline-none"
                                      aria-label="Actions"
                                    >
                                      <MoreVertical className="size-4 text-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} className="w-48 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${workspaceId}/library/papers/${paper.id}`)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                                    >
                                      <BookOpen className="size-3.5 text-foreground shrink-0" />
                                      <span>Open in Reader</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSelectItem(paper)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                                    >
                                      <Quote className="size-3.5 text-foreground shrink-0" />
                                      <span>Cite</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleInitiateSingleTrash(paper)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                                    >
                                      <Trash2 className="size-3.5 text-foreground shrink-0" />
                                      <span>Move to Trash</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 text-xs font-sans">
                          <ContextMenuItem onClick={() => router.push(`/${workspaceId}/library/papers/${paper.id}`)} className="gap-2 text-foreground">
                            <BookOpen className="size-3.5 text-foreground" />
                            <span>Open in Reader</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleSelectItem(paper)} className="gap-2 text-foreground">
                            <Quote className="size-3.5 text-foreground" />
                            <span>Cite</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleInitiateSingleTrash(paper)} className="gap-2 text-foreground">
                            <Trash2 className="size-3.5 text-foreground" />
                            <span>Move to Trash</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Floating batch action bar for library items */}
          <BatchBar
            selectedCount={selectedIds.size}
            selectedItems={sortedItems.filter((tableItem) => selectedIds.has(tableItem.id))}
            collections={collections}
            onClearSelection={clearSelection}
            onBatchMove={handleBatchMoveItems ? (targetCollectionId) => {
              handleBatchMoveItems(Array.from(selectedIds), targetCollectionId);
              clearSelection();
            } : undefined}
            onBatchDelete={handleInitiateBatchTrash}
          />
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedItem || null}
        item={selectedItem || null}
        collection={selectedCollection || null}
        workspaceId={workspaceId}
        onClose={handleCloseInspector}
      />

      {/* Dedicated Add Link to File / Identifier Modal */}
      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingItem}
      />

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onSubmit={handleCreateCollection}
        isPending={isCreatingCollection}
        collections={collections}
      />

      {/* Move to Trash Modal */}
      <TrashModal
        open={isTrashOpen}
        onOpenChange={setIsTrashOpen}
        target={trashTarget}
        onConfirm={handleConfirmTrash}
      />
    </div>
  );
}
