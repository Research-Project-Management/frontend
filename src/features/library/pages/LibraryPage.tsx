'use client';

import React, { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  BookOpen,
  FolderOpen,
  Folder,
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
  FileText,
  Search,
  ShieldAlert,
  Award,
  Star,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import FlagRetractionModal from '../components/modals/FlagRetractionModal';
import AuthorshipModal from '../components/modals/AuthorshipModal';
import TrashModal, { type MoveToTrashTarget } from '../components/modals/TrashModal';
import ProcessModal from '../components/modals/ProcessModal';
import ImportFromPersonalModal from '../components/modals/ImportFromPersonalModal';
import { useRetraction } from '../hooks/use-retraction';
import { ItemService } from '../services/items.service';
import BatchBar from '../components/table/BatchBar';
import { type LibraryDisplayOptions, type LibraryOrderBy } from '../components/LibraryDisplayPopover';
import { Button } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/components/ui";
import { useLibrary } from '../hooks/use-library';
import { useItemTable, type SortField } from '../hooks/use-items';
import { normalizeAuthors, formatCreatorCompact } from '../utils/library.util';
import { cn, copyToClipboard } from "@/shared/lib/utils";
import { CitationService } from '../services/citation.service';
import { generateCitationKey } from '../utils/bibtex.util';
import type { Item } from '../types/library.types';

export default function LibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    effectiveScopeId,
    workspaceSlug,
    isLoading,
    search,
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [retractionModalItem, setRetractionModalItem] = useState<Item | null>(null);
  const [authorshipModalItem, setAuthorshipModalItem] = useState<Item | null>(null);
  const [isUpdatingAuthorship, setIsUpdatingAuthorship] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const isProjectScope = state.activeScope?.type === 'project';
  const canEdit =
    !isProjectScope ||
    state.activeScope?.role === 'owner' ||
    state.activeScope?.role === 'contributor';

  const queryClient = useQueryClient();

  const handleConfirmAuthorship = async (itemId: string, isMyPublication: boolean) => {
    try {
      setIsUpdatingAuthorship(true);
      await ItemService.setMyPublication(workspaceId, itemId, isMyPublication);
      toast.success(
        isMyPublication
          ? 'Added to My Publications'
          : 'Removed from My Publications',
        { id: 'authorship-status' }
      );
      queryClient.invalidateQueries({ queryKey: ['items', workspaceId] });
    } catch (err: any) {
      toast.error('Failed to update publication status', {
        description: err?.message,
        id: 'authorship-status',
      });
    } finally {
      setIsUpdatingAuthorship(false);
    }
  };

  const handleToggleStar = async (paper: Item) => {
    const isStarred =
      (typeof paper.rating === 'number' && paper.rating > 0) ||
      Boolean((paper as any).isStarred) ||
      Boolean((paper as any).states?.[0]?.rating > 0);
    const newRating = isStarred ? 0 : 5;
    try {
      await ItemService.updateItem(effectiveScopeId || workspaceId, paper.id, { rating: newRating });
      toast.success(isStarred ? 'Removed from Starred' : 'Added to Starred', { id: 'star-status' });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    } catch (err: any) {
      toast.error('Failed to update star status', { description: err?.message, id: 'star-status' });
    }
  };

  const {
    flagItem: flagRetraction,
    unflagItem: unflagRetraction,
    checkWorkspace,
    isCheckingWorkspace,
    isFlagging,
  } = useRetraction(effectiveScopeId || workspaceId);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        handleDirectFilesUpload(files);
      }
    },
    [handleDirectFilesUpload],
  );

  const {
    sortedItems,
    sortField,
    sortOrder,
    handleSort,
    setSortField,
    setSortOrder,
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

  const [displayOptions, setDisplayOptions] = useState<LibraryDisplayOptions>({
    columns: {
      authors: true,
      year: true,
      publication: true,
      citations: false,
      dateAdded: false,
      collection: !isProjectScope && activeFilter !== 'unfiled',
    },
    orderBy: 'createdAt',
    orderDirection: 'desc',
    density: 'comfortable',
  });

  const handleDisplayOptionsChange = useCallback((newOpts: LibraryDisplayOptions) => {
    setDisplayOptions(newOpts);
    if (newOpts.orderBy !== sortField) {
      setSortField(newOpts.orderBy as SortField);
    }
    if (newOpts.orderDirection !== sortOrder) {
      setSortOrder(newOpts.orderDirection);
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  const handleSelectItem = (item: Item) => {
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

  const handleRowClick = (e: React.MouseEvent, item: Item) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    handleSelectItem(item);
  };

  const handleRowDoubleClick = (e: React.MouseEvent, item: Item) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    if (item.id) {
      const isSandbox = pathname?.includes('library-sandbox');
      const prefix = isSandbox ? '/library-sandbox/papers' : '/library/papers';
      router.push(`${prefix}/${item.id}`);
    }
  };

  const handleInitiateSingleTrash = (item: Item) => {
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

  const handleQuickCopyCitation = useCallback(
    async (itemsToCopy?: Item[]) => {
      const targetItems =
        itemsToCopy && itemsToCopy.length > 0
          ? itemsToCopy
          : selectedIds.size > 0
            ? sortedItems.filter((i) => selectedIds.has(i.id))
            : selectedItem
              ? [selectedItem]
              : [];

      if (targetItems.length === 0) {
        toast.info('Select a reference to copy citation (Ctrl+Shift+C)', {
          id: 'quick-cite-shortcut',
        });
        return;
      }

      const itemIds = targetItems.map((p) => p.id).filter(Boolean);
      try {
        const res = await CitationService.batchFormat(
          effectiveScopeId || workspaceId,
          itemIds,
          'apa',
        );
        const text = res.citations
          .map((c) => c.citation?.bibliography)
          .filter(Boolean)
          .join('\n\n');

        if (text) {
          await copyToClipboard(text);
          toast.success(
            targetItems.length === 1
              ? 'Copied APA citation to clipboard'
              : `Copied ${targetItems.length} APA citations to clipboard`,
            { id: 'quick-cite-shortcut' },
          );
          return;
        }
      } catch {
        // Fallback to in-text or cite command
      }

      const keys = targetItems.map((p) => generateCitationKey(p)).filter(Boolean);
      const citeCmd = `\\cite{${keys.join(', ')}}`;
      await copyToClipboard(citeCmd);
      toast.success(`Copied citation key ${citeCmd} to clipboard`, {
        id: 'quick-cite-shortcut',
      });
    },
    [selectedIds, sortedItems, selectedItem, effectiveScopeId, workspaceId],
  );

  // Global Zotero Hotkey: Ctrl+Shift+C / Cmd+Shift+C to Quick Copy Citation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        handleQuickCopyCitation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleQuickCopyCitation]);

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
          <ArrowDown className="size-3.5 text-foreground shrink-0" />
        ) : (
          <ArrowUp className="size-3.5 text-foreground shrink-0" />
        )}
      </span>
    );
  };

  const getPageInfo = () => {
    if (selectedCollection) {
      return { title: selectedCollection.name, icon: FolderOpen };
    }
    if (isProjectScope && !activeFilter) {
      return { title: state.activeScope?.name || 'Project Library', icon: Folder };
    }
    switch (activeFilter) {
      case 'recent-read':
        return { title: 'Recently Read', icon: History };
      case 'unfiled':
        return { title: 'Unfiled Items', icon: Inbox };
      case 'starred':
      case 'favorites':
        return { title: 'Starred Items', icon: Star };
      case 'duplicates':
        return { title: 'Duplicate Items', icon: Files };
      case 'trash':
        return { title: 'Trash', icon: Trash2 };
      case 'retracted':
        return { title: 'Retracted Items', icon: ShieldAlert };
      case 'my-publications':
      case 'publications':
        return { title: 'My Publications', icon: Award };
      case 'saved-search':
        return {
          title: (state as any).activeSavedSearch?.name || 'Saved Search',
          icon: Search,
        };
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
          workspaceId={workspaceId}
          items={state.items}
          showFilter={activeFilter !== 'trash'}
          displayOptions={displayOptions}
          onDisplayOptionsChange={handleDisplayOptionsChange}
          onDirectFilesUpload={canEdit && activeFilter !== 'trash' ? handleDirectFilesUpload : undefined}
          onDirectFolderUpload={canEdit && activeFilter !== 'trash' ? handleDirectFolderUpload : undefined}
          onAddCollection={canEdit && activeFilter !== 'trash' ? () => setCreateCollectionOpen(true) : undefined}
          onAddLink={canEdit && activeFilter !== 'trash' ? () => setAddLinkOpen(true) : undefined}
          onImportFromPersonal={isProjectScope && canEdit && activeFilter !== 'trash' ? () => setIsImportModalOpen(true) : undefined}
        >
          {activeFilter === 'retracted' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkWorkspace(undefined)}
              disabled={isCheckingWorkspace}
              className="h-8 gap-1.5 px-3 rounded-md text-xs font-normal border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <ShieldAlert className="size-3.5 shrink-0" />
              <span>{isCheckingWorkspace ? 'Scanning...' : 'Scan Retractions'}</span>
            </Button>
          )}
        </Topbar>

        {/* Central Items Table - Managed Directly by LibraryPage */}
        <div
          className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drop Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/95 border-2 border-dashed border-primary rounded-md p-6 pointer-events-none select-none">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-2.5">
                <FileText className="size-6 text-primary shrink-0" />
              </div>
              <p className="text-13 font-medium text-foreground">Drop references or PDFs here</p>
              <p className="text-11 text-muted-foreground mt-0.5">Supports .bib, .ris, and .pdf files</p>
            </div>
          )}
          {isLoading && filteredItems.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, skeletonIndex) => (
                <div key={skeletonIndex} className="flex items-center gap-3 py-2 border-b border-border">
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
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                {activeFilter === 'my-publications' || activeFilter === 'publications' ? (
                  <Award className="size-6 text-muted-foreground shrink-0" />
                ) : activeFilter === 'retracted' ? (
                  <ShieldAlert className="size-6 text-muted-foreground shrink-0" />
                ) : activeFilter === 'saved-search' ? (
                  <Search className="size-6 text-muted-foreground shrink-0" />
                ) : activeFilter === 'starred' || activeFilter === 'favorites' ? (
                  <Star className="size-6 text-muted-foreground shrink-0" />
                ) : (
                  <BookOpen className="size-6 text-muted-foreground shrink-0" />
                )}
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                {activeFilter === 'my-publications' || activeFilter === 'publications'
                  ? 'No publications listed'
                  : activeFilter === 'retracted'
                  ? 'No retracted items'
                  : activeFilter === 'saved-search'
                  ? 'No matching results'
                  : activeFilter === 'starred' || activeFilter === 'favorites'
                  ? 'No starred items'
                  : 'No references found'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search.trim()
                  ? 'No references matching your search query.'
                  : activeFilter === 'my-publications' || activeFilter === 'publications'
                  ? 'No authored publications yet. Flag items with your authorship to list them here.'
                  : activeFilter === 'retracted'
                  ? 'No retracted items detected in your library. All items appear clear.'
                  : activeFilter === 'saved-search'
                  ? 'No references currently match the conditions of this saved search.'
                  : activeFilter === 'starred' || activeFilter === 'favorites'
                  ? "You haven't starred any references yet. Rate or star references to easily access your key papers."
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
              ) : null}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-10" />
                  <col className="min-w-[200px]" />
                  {displayOptions.columns.authors && <col className="w-[180px] sm:w-[220px]" />}
                  {displayOptions.columns.year && <col className="w-[70px]" />}
                  {displayOptions.columns.publication && <col className="w-[160px] sm:w-[200px]" />}
                  {displayOptions.columns.citations && <col className="w-[75px]" />}
                  {displayOptions.columns.collection && activeFilter !== 'unfiled' && (
                    <col className={isProjectScope ? 'w-2/12' : 'w-3/12'} />
                  )}
                  {isProjectScope && (
                    <col className="w-[120px]" />
                  )}
                  {displayOptions.columns.dateAdded && (
                    <col className={activeFilter === 'unfiled' ? 'w-[120px]' : 'w-[110px]'} />
                  )}
                  <col className="w-10" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-background border-b border-border select-none">
                  <tr className={cn(
                    "type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground",
                    displayOptions.density === 'compact' ? "h-8" : "h-9"
                  )}>
                    <th scope="col" className="w-10 px-2.5 py-1 text-center align-middle">
                      <Checkbox
                        checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      aria-sort={hasUserSorted && sortField === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      tabIndex={0}
                      onClick={() => onColumnSort('title')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('title');
                        }
                      }}
                      className="group/th px-3.5 py-1 align-middle cursor-pointer min-w-0 truncate outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Title</span>
                        {renderSortIcon('title')}
                      </div>
                    </th>
                    {displayOptions.columns.authors && (
                      <th
                        scope="col"
                        role="columnheader"
                        aria-sort={hasUserSorted && sortField === 'authors' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                        tabIndex={0}
                        onClick={() => onColumnSort('authors')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onColumnSort('authors');
                          }
                        }}
                        className="group/th px-3.5 py-1 align-middle cursor-pointer truncate outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                      >
                        <div className="flex items-center">
                          <span className="truncate">Creator</span>
                          {renderSortIcon('authors')}
                        </div>
                      </th>
                    )}
                    {displayOptions.columns.year && (
                      <th
                        scope="col"
                        role="columnheader"
                        aria-sort={hasUserSorted && sortField === 'year' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                        tabIndex={0}
                        onClick={() => onColumnSort('year')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onColumnSort('year');
                          }
                        }}
                        className="group/th px-3.5 py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                      >
                        <div className="flex items-center">
                          <span className="whitespace-nowrap">Year</span>
                          {renderSortIcon('year')}
                        </div>
                      </th>
                    )}
                    {displayOptions.columns.publication && (
                      <th
                        scope="col"
                        role="columnheader"
                        aria-sort={hasUserSorted && sortField === 'journal' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                        tabIndex={0}
                        onClick={() => onColumnSort('journal')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onColumnSort('journal');
                          }
                        }}
                        className="group/th px-3.5 py-1 align-middle cursor-pointer truncate outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                      >
                        <div className="flex items-center">
                          <span className="truncate">Publication</span>
                          {renderSortIcon('journal')}
                        </div>
                      </th>
                    )}
                    {displayOptions.columns.citations && (
                      <th
                        scope="col"
                        role="columnheader"
                        aria-sort={hasUserSorted && sortField === 'citationCount' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                        tabIndex={0}
                        onClick={() => onColumnSort('citationCount')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onColumnSort('citationCount');
                          }
                        }}
                        className="group/th px-3.5 py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                      >
                        <div className="flex items-center">
                          <span className="whitespace-nowrap">Citations</span>
                          {renderSortIcon('citationCount')}
                        </div>
                      </th>
                    )}
                    {displayOptions.columns.collection && activeFilter !== 'unfiled' && (
                      <th scope="col" className="px-3.5 py-1 align-middle truncate">
                        <span className="truncate">Collection</span>
                      </th>
                    )}
                    {isProjectScope && (
                      <th scope="col" className="px-3.5 py-1 align-middle truncate">
                        <span className="truncate">Added By</span>
                      </th>
                    )}
                    {displayOptions.columns.dateAdded && (
                      <th
                        scope="col"
                        role="columnheader"
                        aria-sort={hasUserSorted && sortField === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                        tabIndex={0}
                        onClick={() => onColumnSort('createdAt')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onColumnSort('createdAt');
                          }
                        }}
                        className="group/th px-3.5 py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                      >
                        <div className="flex items-center">
                          <span className="whitespace-nowrap">Date Added</span>
                          {renderSortIcon('createdAt')}
                        </div>
                      </th>
                    )}
                    <th scope="col" className="w-10 px-2 py-1" />
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
                    const addedByUser = (paper as any).user || (paper as any).uploadedBy;
                    const addedByName = addedByUser?.name || addedByUser?.email || '—';

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            onClick={(clickEvent) => handleRowClick(clickEvent, paper)}
                            onDoubleClick={(clickEvent) => handleRowDoubleClick(clickEvent, paper)}
                            draggable={canEdit}
                            onDragStart={(e) => {
                              const idsToMove = selectedIds.has(paper.id)
                                ? Array.from(selectedIds)
                                : [paper.id];
                              e.dataTransfer.setData(
                                'application/x-flux-items',
                                JSON.stringify({ ids: idsToMove, title: paper.title })
                              );
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            className={cn(
                              'group transition-colors cursor-pointer border-b border-border',
                              displayOptions.density === 'compact' ? 'h-7.5 text-11' : 'h-9 text-12',
                              isSelected ? 'bg-muted' : isActive ? 'bg-muted' : 'hover:bg-muted',
                            )}
                          >
                            <td className={cn("w-10 px-2.5 text-center align-middle", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")} onClick={(clickEvent) => clickEvent.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(paper.id)}
                                aria-label={`Select ${paper.title || 'reference'}`}
                              />
                            </td>

                            <td className={cn("px-3.5 align-middle min-w-0 max-w-0 truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                              <div className="flex items-center gap-2 min-w-0">
                                {paper.isMyPublication && (
                                  <span
                                    title="You are an author/co-author of this publication"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-10 font-medium bg-primary/10 text-primary border border-primary/20 shrink-0 select-none"
                                  >
                                    <Award className="size-2.5 shrink-0" />
                                    Author
                                  </span>
                                )}
                                {paper.isRetracted && (
                                  <span
                                    title={`Retracted: ${(paper.retractionDetails as any)?.reason || paper.retractionNature || 'Retracted'}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-10 font-medium bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-900 shrink-0 select-none"
                                  >
                                    <ShieldAlert className="size-2.5 shrink-0" />
                                    Retracted
                                  </span>
                                )}
                                {((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) && (
                                  <Star className="size-3 fill-amber-400 text-amber-500 shrink-0 select-none" />
                                )}
                                <span className="truncate block type-dense font-normal text-foreground" title={paper.title || 'Untitled Reference'}>
                                  {paper.title || 'Untitled Reference'}
                                </span>
                              </div>
                            </td>

                            {displayOptions.columns.authors && (
                              <td className={cn("px-3.5 align-middle max-w-0 truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                <span className="truncate block type-dense font-normal text-foreground" title={authorFull}>
                                  {authorCompact}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.year && (
                              <td className={cn("px-3.5 align-middle type-dense font-normal text-foreground tabular-nums truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                {paper.year || '—'}
                              </td>
                            )}

                            {displayOptions.columns.publication && (
                              <td className={cn("px-3.5 align-middle max-w-0 truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                <span className="truncate block type-dense font-normal text-foreground" title={paper.publicationTitle || paper.journal || paper.publisher || '—'}>
                                  {paper.publicationTitle || paper.journal || paper.publisher || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.citations && (
                              <td className={cn("px-3.5 align-middle type-dense font-normal text-foreground tabular-nums truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                {paper.citationCount ?? '—'}
                              </td>
                            )}

                            {displayOptions.columns.collection && activeFilter !== 'unfiled' && (
                              <td className={cn("px-3.5 align-middle max-w-0 truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                <span className="truncate block type-dense font-normal text-foreground" title={collection?.name || 'Unfiled'}>
                                  {collection?.name || 'Unfiled'}
                                </span>
                              </td>
                            )}

                            {isProjectScope && (
                              <td className={cn("px-3.5 align-middle max-w-0 truncate", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                <span className="truncate block type-dense font-normal text-foreground" title={addedByName}>
                                  {addedByName}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.dateAdded && (
                              <td className={cn("px-3.5 align-middle type-dense font-normal text-muted-foreground whitespace-nowrap", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")}>
                                {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString() : '—'}
                              </td>
                            )}

                            {/* Row options menu */}
                            <td className={cn("w-10 px-2 text-right align-middle", displayOptions.density === 'compact' ? "py-0.5" : "py-1.5")} onClick={(clickEvent) => clickEvent.stopPropagation()}>
                              <div className="flex items-center justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="flex size-7 shrink-0 items-center justify-center rounded-sm text-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      aria-label={`Options for ${paper.title || 'reference'}`}
                                    >
                                      <MoreVertical className="size-3.5 text-foreground shrink-0" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    side="bottom"
                                    align="end"
                                    sideOffset={4}
                                    collisionPadding={12}
                                    className="w-52 p-1 rounded-md border border-border bg-popover text-popover-foreground z-50 text-xs shadow-none space-y-0.5"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/library/papers/${paper.id}`)}
                                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <BookOpen className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                      <span>Open in Reader</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleQuickCopyCitation([paper])}
                                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary justify-between"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Copy Citation</span>
                                      </div>
                                      <span className="text-10 text-muted-foreground font-mono">Ctrl+Shift+C</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleToggleStar(paper)}
                                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <Star className={cn("size-3.5 shrink-0", ((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) ? "fill-amber-400 text-amber-500" : "text-foreground")} strokeWidth={1.5} />
                                      <span>{((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) ? 'Remove from Starred' : 'Add to Starred'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSelectItem(paper)}
                                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                      <span>Cite in Inspector</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setAuthorshipModalItem(paper)}
                                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <Award className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                      <span>{paper.isMyPublication ? 'Authorship Details' : 'Add to My Publications'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setRetractionModalItem(paper)}
                                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <ShieldAlert className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                      <span>{paper.isRetracted ? 'Retraction Details' : 'Flag as Retracted'}</span>
                                    </DropdownMenuItem>
                                    {canEdit && (
                                      <DropdownMenuItem
                                        onClick={() => handleInitiateSingleTrash(paper)}
                                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      >
                                        <Trash2 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Move to Trash</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 text-12 font-sans">
                          <ContextMenuItem onClick={() => router.push(`/library/papers/${paper.id}`)} className="gap-2 text-foreground">
                            <BookOpen className="size-3.5 text-foreground shrink-0" />
                            <span>Open in Reader</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleQuickCopyCitation([paper])} className="gap-2 text-foreground justify-between">
                            <div className="flex items-center gap-2">
                              <Quote className="size-3.5 text-foreground shrink-0" />
                              <span>Copy Citation</span>
                            </div>
                            <span className="text-10 text-muted-foreground font-mono">Ctrl+Shift+C</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleToggleStar(paper)} className="gap-2 text-foreground">
                            <Star className={cn("size-3.5 shrink-0", ((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) ? "fill-amber-400 text-amber-500" : "text-foreground")} />
                            <span>{((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) ? 'Remove from Starred' : 'Add to Starred'}</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleSelectItem(paper)} className="gap-2 text-foreground">
                            <Quote className="size-3.5 text-foreground shrink-0" />
                            <span>Cite in Inspector</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => setAuthorshipModalItem(paper)} className="gap-2 text-foreground">
                            <Award className="size-3.5 text-foreground shrink-0" />
                            <span>{paper.isMyPublication ? 'Authorship Details' : 'Add to My Publications'}</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => setRetractionModalItem(paper)} className="gap-2 text-foreground">
                            <ShieldAlert className="size-3.5 text-foreground shrink-0" />
                            <span>{paper.isRetracted ? 'Retraction Details' : 'Flag as Retracted'}</span>
                          </ContextMenuItem>
                          {canEdit && (
                            <ContextMenuItem onClick={() => handleInitiateSingleTrash(paper)} className="gap-2 text-foreground">
                              <Trash2 className="size-3.5 text-foreground shrink-0" />
                              <span>Move to Trash</span>
                            </ContextMenuItem>
                          )}
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
            onBatchMove={canEdit && handleBatchMoveItems ? (targetCollectionId) => {
              handleBatchMoveItems(Array.from(selectedIds), targetCollectionId);
              clearSelection();
            } : undefined}
            onBatchDelete={canEdit ? handleInitiateBatchTrash : undefined}
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

      {/* Dedicated Add Link to File Modal */}
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

      {/* Real-time Zotero-style Process Modal */}
      {state.ingestProgressModal && (
        <ProcessModal
          state={state.ingestProgressModal}
          onClose={actions.closeProcessModal}
          onToggleMinimize={actions.toggleMinimizeProcessModal}
          onViewLibrary={() => {
            navigate('/library');
          }}
        />
      )}

      {/* Flag Retraction Modal */}
      <FlagRetractionModal
        open={Boolean(retractionModalItem)}
        onOpenChange={(open) => !open && setRetractionModalItem(null)}
        item={retractionModalItem}
        onFlag={(itemId, data) => flagRetraction({ itemId, data })}
        onUnflag={(itemId) => unflagRetraction(itemId)}
        isPending={isFlagging}
      />

      {/* Authorship Confirmation Modal */}
      <AuthorshipModal
        open={Boolean(authorshipModalItem)}
        onOpenChange={(open) => !open && setAuthorshipModalItem(null)}
        item={authorshipModalItem}
        onConfirmAuthorship={handleConfirmAuthorship}
        isPending={isUpdatingAuthorship}
      />

      {/* Import from Personal Library Modal */}
      {isProjectScope && (
        <ImportFromPersonalModal
          open={isImportModalOpen}
          onOpenChange={setIsImportModalOpen}
          projectId={state.activeScope?.id || ''}
          projectName={state.activeScope?.name || 'Project'}
          existingTitles={filteredItems.map((p) => p.title || '')}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
          }}
        />
      )}
    </div>
  );
}
