'use client';

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
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
  Loader2,
  Check,
  Plus,
  Link2,
  ExternalLink,
  FolderMinus,
  GitMerge,
  FolderSync,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import { useLibrarySidebarStore } from '../store/sidebar.store';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import MergeModal from '../components/modals/MergeModal';
import LibraryEmptyState from '../components/LibraryEmptyState';
import { LibraryIcon } from '@/shared/components/icons';
import FlagRetractionModal from '../components/modals/FlagRetractionModal';
import AuthorshipModal from '../components/modals/AuthorshipModal';
import TrashModal, { type MoveToTrashTarget } from '../components/modals/TrashModal';
import ProcessModal from '../components/modals/ProcessModal';
import ImportFromPersonalModal from '../components/modals/ImportFromPersonalModal';
import { useRetraction } from '../hooks/use-retraction';
import { useMergePapers } from '../hooks/use-curation';
import { useBatchRenameAttachments } from '../hooks/use-attachments';
import { ItemService } from '../services/items.service';
import { CollectionsService } from '../services/collections.service';
import BatchBar from '../components/table/BatchBar';
import {
  type LibraryDisplayOptions,
  type LibraryOrderBy,
  type LibraryColumnKey,
  COLUMN_ITEMS,
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
} from '../components/LibraryDisplayPopover';
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
import {
  normalizeAuthors,
  formatCreatorCompact,
  cleanPaperTitle,
  getPublicationVenue,
  formatItemTypeLabel,
  formatExtraDisplay,
} from '../utils/library.util';
import { ITEM_TYPE_LABELS } from '../schemas/item-type.schema';
import { cn, copyToClipboard } from "@/shared/lib/utils";
import { CitationService } from '../services/citation.service';
import { generateCitationKey } from '../utils/bibtex.util';
import type { Item } from '../types/library.types';

export default function LibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { state, actions } = useLibrary();
  const {
    effectiveScopeId,
    scopeId,
    projectId,
    userId,
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
    handleCreateManualItem,
    setCreateCollectionOpen,
    handleCreateCollection,
    handleDeleteItem,
    handleBatchDeleteItems,
    handleBatchMoveItems,
    navigate,
  } = actions;

  const currentCollectionId = selectedCollection?.id;

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

  const handleRemoveFromCollection = async (paper: Item) => {
    if (!currentCollectionId) return;
    try {
      await CollectionsService.detachItem(effectiveScopeId, currentCollectionId, paper.id);
      toast.success('Removed from collection', {
        description: `"${paper.title || 'Item'}" was removed from this collection.`,
      });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (selectedItemId === paper.id) {
        setSelectedItemId(null);
      }
    } catch (err: any) {
      toast.error('Failed to remove from collection', {
        description: err?.message || 'Please try again.',
      });
    }
  };

  const handleConfirmAuthorship = async (itemId: string, isMyPublication: boolean) => {
    const activeScope = effectiveScopeId || 'user';
    try {
      setIsUpdatingAuthorship(true);
      await ItemService.setMyPublication(activeScope, itemId, isMyPublication);
      toast.success(
        isMyPublication
          ? 'Added to My Publications'
          : 'Removed from My Publications',
        { id: 'authorship-status' }
      );
      queryClient.invalidateQueries({ queryKey: ['items', activeScope] });
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
      await ItemService.updateItem(effectiveScopeId || 'user', paper.id, { rating: newRating });
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
    checkLibrary,
    isCheckingLibrary,
    isFlagging,
  } = useRetraction(effectiveScopeId || 'user');

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

  const mergeMutation = useMergePapers(effectiveScopeId || 'user');
  const [mergeCluster, setMergeCluster] = useState<Item[] | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const batchRenameMutation = useBatchRenameAttachments(effectiveScopeId || 'user');

  const handleExecuteBatchRename = useCallback((itemsToRename: Item[]) => {
    if (!itemsToRename || itemsToRename.length === 0) return;
    batchRenameMutation.mutate({
      itemIds: itemsToRename.map((i) => i.id),
    });
  }, [batchRenameMutation]);

  const handleOpenMerge = useCallback((itemsToMerge: Item[]) => {
    if (!itemsToMerge || itemsToMerge.length < 2) return;
    setMergeCluster(itemsToMerge);
    setMergeOpen(true);
  }, []);

  const handleExecuteMerge = async (
    masterItem: Item,
    mergedFields: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      masterPaperId: masterItem.id,
      sourcePaperIds: duplicateIdsToDelete,
      fieldSelections: Object.keys(mergedFields).length > 0 ? mergedFields : undefined,
    });
    clearSelection();
    setMergeOpen(false);
  };

  const DISPLAY_OPTIONS_STORAGE_KEY = 'flux_library_display_options_v3';

  const [displayOptions, setDisplayOptions] = useState<LibraryDisplayOptions>(
    DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  );

  // Restore saved column/display preferences if previously customized by user
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_OPTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as any;
        if (parsed && typeof parsed === 'object') {
          setDisplayOptions({
            ...DEFAULT_LIBRARY_DISPLAY_OPTIONS,
            ...parsed,
            columns: {
              ...DEFAULT_LIBRARY_DISPLAY_OPTIONS.columns,
              ...(parsed.columns || {}),
            },
          });
        }
      }
    } catch {
      // Ignore parse/storage error
    }
  }, []);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isTableScrolled, setIsTableScrolled] = useState(false);

  // Reset scroll to top when changing filter, view, or search to prevent ghost cut-off rows
  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
      setIsTableScrolled(false);
    }
  }, [activeFilter, pathname, search]);

  const handleDisplayOptionsChange = useCallback(
    (newOpts: LibraryDisplayOptions) => {
      setDisplayOptions(newOpts);
      try {
        localStorage.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(newOpts));
      } catch {
        // Ignore localStorage error
      }
      if (newOpts.orderBy !== sortField) {
        setSortField(newOpts.orderBy as SortField);
      }
      if (newOpts.orderDirection !== sortOrder) {
        setSortOrder(newOpts.orderDirection);
      }
    },
    [sortField, sortOrder, setSortField, setSortOrder],
  );

  const handleToggleColumn = useCallback((colKey: LibraryColumnKey) => {
    setDisplayOptions((prev) => {
      const next = {
        ...prev,
        columns: {
          ...prev.columns,
          [colKey]: !prev.columns[colKey],
        },
      };
      try {
        localStorage.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage error
      }
      return next;
    });
  }, []);

  // Compute dynamic minimum table width based on active columns and current filter scope
  // to ensure columns maintain optical hierarchy without squishing on display/filter changes.
  const minTableWidth = useMemo(() => {
    // 44 (checkbox) + 320 (flexible Title min-width) + 44 (row action menu)
    let width = 408;
    const cols = displayOptions.columns;
    if (cols.authors) width += 240;
    if (cols.year) width += 72;
    if (cols.publication) width += 240;
    if (cols.itemType) width += 160;
    if (cols.publisher) width += 190;
    if (cols.doi) width += 250;
    if (cols.citationKey) width += 210;
    if (cols.citations) width += 84;
    if (cols.references) width += 84;
    if (cols.pages) width += 84;
    if (cols.volume) width += 76;
    if (cols.issue) width += 76;
    if (cols.edition) width += 96;
    if (cols.language) width += 110;
    if (cols.extra) width += 240;
    if (cols.collection && activeFilter !== 'unfiled') width += 180;
    if (isProjectScope) width += 150;
    if (cols.dateAdded) width += 116;
    if (cols.dateModified) width += 116;
    return width;
  }, [displayOptions.columns, activeFilter, isProjectScope]);

  // When only Creator is enabled as an optional column, give it a proportional 32%
  // so Title gets 68% and no massive empty whitespace gap is left on wide screens.
  const isOnlyAuthors = useMemo(() => {
    const cols = displayOptions.columns;
    const activeCount = Object.values(cols).filter(Boolean).length;
    return Boolean(cols.authors && activeCount === 1);
  }, [displayOptions.columns]);

  const { isInspectorOpen, setIsInspectorOpen } = useLibrarySidebarStore();

  const handleSelectItem = (item: Item) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
      setIsInspectorOpen(false);
    } else {
      setSelectedItemId(itemId);
      setIsInspectorOpen(true);
    }
  };

  const handleCloseInspector = useCallback(() => {
    setSelectedItemId(null);
    setIsInspectorOpen(false);
  }, [setSelectedItemId, setIsInspectorOpen]);

  const handleToggleInspector = useCallback(() => {
    if (isInspectorOpen) {
      setIsInspectorOpen(false);
      setSelectedItemId(null);
    } else {
      if (!selectedItemId && sortedItems.length > 0) {
        setSelectedItemId(sortedItems[0].id);
      }
      setIsInspectorOpen(true);
    }
  }, [isInspectorOpen, selectedItemId, sortedItems, setSelectedItemId, setIsInspectorOpen]);

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
      if ((item as any).isPending) return;
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
          effectiveScopeId || 'user',
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
    [selectedIds, sortedItems, selectedItem, effectiveScopeId],
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
        return { title: 'Library', icon: LibraryIcon };
    }
  };

  const { title: pageTitle, icon: PageIcon } = getPageInfo();

  const isCompact = displayOptions.density === 'compact';
  const cellPad = isCompact ? "px-2.5 py-0.5" : "px-3.5 py-1.5";
  const numCellPad = isCompact ? "px-2 py-0.5" : "px-3 py-1.5";
  const thPad = isCompact ? "px-2.5 py-1" : "px-3.5 py-1";
  const numThPad = isCompact ? "px-2 py-1" : "px-3 py-1";

  return (
    <div className="flex-1 flex overflow-hidden font-sans">
      {/* Central Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Library Toolbar */}
        <Topbar
          title={pageTitle}
          icon={PageIcon}
          search={search}
          onSearchChange={setSearch}
          scopeId={effectiveScopeId}
          items={state.items}
          showFilter={activeFilter !== 'trash'}
          displayOptions={displayOptions}
          onDisplayOptionsChange={handleDisplayOptionsChange}
          onDirectFilesUpload={canEdit && activeFilter !== 'trash' ? handleDirectFilesUpload : undefined}
          onDirectFolderUpload={canEdit && activeFilter !== 'trash' ? handleDirectFolderUpload : undefined}
          onNewManualItem={canEdit && activeFilter !== 'trash' ? async (itemType) => {
            const newItem = await handleCreateManualItem(itemType);
            if (newItem) {
              setIsInspectorOpen(true);
            }
          } : undefined}
          onAddCollection={canEdit && activeFilter !== 'trash' ? () => setCreateCollectionOpen(true) : undefined}
          onAddLink={canEdit && activeFilter !== 'trash' ? () => setAddLinkOpen(true) : undefined}
          onImportFromPersonal={isProjectScope && canEdit && activeFilter !== 'trash' ? () => setIsImportModalOpen(true) : undefined}
          onToggleInspector={handleToggleInspector}
        >
          {activeFilter === 'retracted' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkLibrary(undefined)}
              disabled={isCheckingLibrary}
              className="h-8 gap-1.5 px-3 rounded-md text-xs font-normal border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <ShieldAlert className="size-3.5 shrink-0" />
              <span>{isCheckingLibrary ? 'Scanning...' : 'Scan Retractions'}</span>
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
            <LibraryEmptyState
              search={search}
              activeFilter={activeFilter}
              onClearSearch={() => setSearch('')}
              onDirectFilesUpload={canEdit && activeFilter !== 'trash' ? handleDirectFilesUpload : undefined}
              onAddLink={canEdit && activeFilter !== 'trash' ? () => setAddLinkOpen(true) : undefined}
              onAddCollection={canEdit && activeFilter !== 'trash' ? () => setCreateCollectionOpen(true) : undefined}
              canEdit={canEdit && activeFilter !== 'trash'}
            />
          ) : (
            <div
              ref={tableContainerRef}
              className="flex-1 overflow-auto"
              style={{
                scrollPaddingTop: displayOptions.density === 'compact' ? '32px' : '36px',
              }}
              onScroll={(e) => {
                const scrolled = e.currentTarget.scrollTop > 2;
                if (scrolled !== isTableScrolled) {
                  setIsTableScrolled(scrolled);
                }
              }}
            >
              <table
                className="w-full table-fixed text-left border-collapse"
                style={{ minWidth: minTableWidth }}
              >
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col className="min-w-[320px]" />
                  {displayOptions.columns.authors && <col style={{ width: isOnlyAuthors ? '32%' : 240 }} />}
                  {displayOptions.columns.year && <col style={{ width: 72 }} />}
                  {displayOptions.columns.publication && <col style={{ width: 240 }} />}
                  {displayOptions.columns.itemType && <col style={{ width: 160 }} />}
                  {displayOptions.columns.publisher && <col style={{ width: 190 }} />}
                  {displayOptions.columns.doi && <col style={{ width: 250 }} />}
                  {displayOptions.columns.citationKey && <col style={{ width: 210 }} />}
                  {displayOptions.columns.citations && <col style={{ width: 84 }} />}
                  {displayOptions.columns.references && <col style={{ width: 84 }} />}
                  {displayOptions.columns.pages && <col style={{ width: 84 }} />}
                  {displayOptions.columns.volume && <col style={{ width: 76 }} />}
                  {displayOptions.columns.issue && <col style={{ width: 76 }} />}
                  {displayOptions.columns.edition && <col style={{ width: 96 }} />}
                  {displayOptions.columns.language && <col style={{ width: 110 }} />}
                  {displayOptions.columns.extra && <col style={{ width: 240 }} />}
                  {displayOptions.columns.collection && activeFilter !== 'unfiled' && (
                    <col style={{ width: 180 }} />
                  )}
                  {isProjectScope && (
                    <col style={{ width: 150 }} />
                  )}
                  {displayOptions.columns.dateAdded && (
                    <col style={{ width: 116 }} />
                  )}
                  {displayOptions.columns.dateModified && (
                    <col style={{ width: 116 }} />
                  )}
                  <col style={{ width: 44 }} />
                </colgroup>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <thead className={cn(
                      "sticky top-0 z-20 bg-background border-b border-border select-none transition-shadow",
                      isTableScrolled && "shadow-2xs"
                    )}>
                      <tr className={cn(
                        "type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground",
                        displayOptions.density === 'compact' ? "h-8" : "h-9"
                      )}>
                        <th
                          scope="col"
                          className="w-8 pl-3 pr-1 py-1 text-left align-middle whitespace-nowrap bg-background"
                        >
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
                          className={cn(
                            "group/th py-1 align-middle cursor-pointer min-w-0 whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none bg-background pl-1.5 pr-3.5"
                          )}
                        >
                          <div className="flex items-center">
                            <span className="whitespace-nowrap">Title</span>
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
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              thPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">Creator</span>
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
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              numThPad
                            )}
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
                            aria-sort={hasUserSorted && (sortField === 'publicationTitle' || sortField === 'journal') ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                            tabIndex={0}
                            onClick={() => onColumnSort('publicationTitle')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onColumnSort('publicationTitle');
                              }
                            }}
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              thPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">Publication</span>
                              {renderSortIcon('publicationTitle') || renderSortIcon('journal')}
                            </div>
                          </th>
                        )}
                        {displayOptions.columns.itemType && (
                          <th
                            scope="col"
                            role="columnheader"
                            aria-sort={hasUserSorted && sortField === 'itemType' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                            tabIndex={0}
                            onClick={() => onColumnSort('itemType')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onColumnSort('itemType');
                              }
                            }}
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              thPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">Type</span>
                              {renderSortIcon('itemType')}
                            </div>
                          </th>
                        )}
                        {displayOptions.columns.publisher && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span className="whitespace-nowrap">Publisher</span>
                          </th>
                        )}
                        {displayOptions.columns.doi && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span className="whitespace-nowrap">DOI</span>
                          </th>
                        )}
                        {displayOptions.columns.citationKey && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span className="whitespace-nowrap">Citation Key</span>
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
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              numThPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">Citations</span>
                              {renderSortIcon('citationCount')}
                            </div>
                          </th>
                        )}
                        {displayOptions.columns.references && (
                          <th
                            scope="col"
                            role="columnheader"
                            tabIndex={0}
                            className={cn(
                              "group/th py-1 align-middle whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              numThPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">References</span>
                            </div>
                          </th>
                        )}
                        {displayOptions.columns.pages && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span className="whitespace-nowrap">Pages</span>
                          </th>
                        )}
                        {displayOptions.columns.volume && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span className="whitespace-nowrap">Volume</span>
                          </th>
                        )}
                        {displayOptions.columns.issue && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span className="whitespace-nowrap">Issue</span>
                          </th>
                        )}
                        {displayOptions.columns.edition && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span className="whitespace-nowrap">Edition</span>
                          </th>
                        )}
                        {displayOptions.columns.language && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span className="whitespace-nowrap">Language</span>
                          </th>
                        )}
                        {displayOptions.columns.extra && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span className="whitespace-nowrap">Extra</span>
                          </th>
                        )}
                        {displayOptions.columns.collection && activeFilter !== 'unfiled' && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap", thPad)}>
                            <span className="whitespace-nowrap">Collection</span>
                          </th>
                        )}
                        {isProjectScope && (
                          <th scope="col" className={cn("py-1 align-middle whitespace-nowrap", thPad)}>
                            <span className="whitespace-nowrap">Added By</span>
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
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              numThPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">Date Added</span>
                              {renderSortIcon('createdAt')}
                            </div>
                          </th>
                        )}
                        {displayOptions.columns.dateModified && (
                          <th
                            scope="col"
                            role="columnheader"
                            aria-sort={hasUserSorted && sortField === 'updatedAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                            tabIndex={0}
                            onClick={() => onColumnSort('updatedAt')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onColumnSort('updatedAt');
                              }
                            }}
                            className={cn(
                              "group/th py-1 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none",
                              numThPad
                            )}
                          >
                            <div className="flex items-center">
                              <span className="whitespace-nowrap">Date Modified</span>
                              {renderSortIcon('updatedAt')}
                            </div>
                          </th>
                        )}
                        <th scope="col" className="w-11 px-2 py-1 whitespace-nowrap bg-background" />
                      </tr>
                    </thead>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 text-xs shadow-none">
                    <div className="px-2 py-1 text-11 font-semibold text-muted-foreground select-none">Toggle Columns</div>
                    {COLUMN_ITEMS.map((col) => (
                      <ContextMenuItem
                        key={col.key}
                        onClick={() => handleToggleColumn(col.key)}
                        className="flex items-center justify-between px-2 py-1.5 text-12 cursor-pointer rounded hover:bg-muted"
                      >
                        <span>{col.label}</span>
                        {displayOptions.columns[col.key] && <Check className="size-3 text-primary shrink-0" strokeWidth={2} />}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuContent>
                </ContextMenu>
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
                    const rawItemType = (paper as any).itemType || (paper as any).item_type || (paper as any).type || (paper as any).cslType;
                    const itemTypeLabel = (rawItemType && ITEM_TYPE_LABELS[rawItemType]) || formatItemTypeLabel(rawItemType);
                    const extraDisplay = formatExtraDisplay(paper);
                    const paperDoi = paper.doi || (paper.extraFields as any)?.doi || '—';
                    const citeKey = paper.citationKey || (paper as any)?.bibtexKey || generateCitationKey(paper);
                    const publicationVenue = getPublicationVenue(paper);

                    const isPending = Boolean((paper as any).isPending);
                    const pendingStatus = (paper as any).pendingStatus as 'uploading' | 'processing' | 'succeeded' | 'failed' | undefined;
                    const pendingError = (paper as any).pendingError as string | undefined;

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild disabled={isPending}>
                          <tr
                            onClick={(clickEvent) => {
                              if (isPending) return;
                              handleRowClick(clickEvent, paper);
                            }}
                            onDoubleClick={(clickEvent) => {
                              if (isPending) return;
                              handleRowDoubleClick(clickEvent, paper);
                            }}
                            draggable={canEdit && !isPending}
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
                            <td
                              className={cn(
                                "w-8 pl-3 pr-1 text-left align-middle",
                                isCompact ? "py-0.5" : "py-1.5"
                              )}
                              onClick={(clickEvent) => clickEvent.stopPropagation()}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(paper.id)}
                                aria-label={`Select ${paper.title || 'reference'}`}
                                disabled={isPending}
                              />
                            </td>

                            <td className={cn("align-middle min-w-0 truncate pl-1.5 pr-3.5", isCompact ? "py-0.5" : "py-1.5")}>
                              <div className="flex items-center gap-2 min-w-0">
                                {!isPending && (
                                  <>
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
                                  </>
                                )}
                                <span
                                  className="truncate block type-dense font-normal text-foreground"
                                  title={cleanPaperTitle(paper.title) || 'Untitled Reference'}
                                >
                                  {cleanPaperTitle(paper.title) || 'Untitled Reference'}
                                </span>
                              </div>
                            </td>

                            {displayOptions.columns.authors && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span
                                  className="truncate block type-dense font-normal text-foreground"
                                  title={isPending ? "" : authorFull}
                                >
                                  {isPending ? "—" : authorCompact}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.year && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {isPending ? '—' : (paper.year || '—')}
                              </td>
                            )}

                            {displayOptions.columns.publication && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground" title={publicationVenue}>
                                  {publicationVenue}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.itemType && (
                              <td className={cn("align-middle whitespace-nowrap", cellPad)}>
                                <span className="whitespace-nowrap block type-dense font-normal text-foreground" title={itemTypeLabel}>
                                  {itemTypeLabel}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.publisher && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground" title={paper.publisher || '—'}>
                                  {paper.publisher || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.doi && (
                              <td className={cn("align-middle whitespace-nowrap", cellPad)}>
                                <span className="whitespace-nowrap block type-dense font-mono text-11 text-foreground" title={paperDoi}>
                                  {paperDoi}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.citationKey && (
                              <td className={cn("align-middle whitespace-nowrap", cellPad)}>
                                <span className="whitespace-nowrap block type-dense font-mono text-11 text-foreground" title={citeKey}>
                                  {citeKey || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.citations && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.citationCount != null ? Number(paper.citationCount).toLocaleString() : '—'}
                              </td>
                            )}

                            {displayOptions.columns.references && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.referenceCount != null ? Number(paper.referenceCount).toLocaleString() : '—'}
                              </td>
                            )}

                            {displayOptions.columns.pages && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {(paper as any).pages || (paper.extraFields as any)?.pages || '—'}
                              </td>
                            )}

                            {displayOptions.columns.volume && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {(paper as any).volume || (paper.extraFields as any)?.volume || '—'}
                              </td>
                            )}

                            {displayOptions.columns.issue && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {(paper as any).issue || (paper.extraFields as any)?.issue || '—'}
                              </td>
                            )}

                            {displayOptions.columns.edition && (
                              <td className={cn("align-middle whitespace-nowrap", cellPad)}>
                                <span className="whitespace-nowrap block type-dense font-normal text-foreground">
                                  {(paper as any).edition || (paper.extraFields as any)?.edition || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.language && (
                              <td className={cn("align-middle whitespace-nowrap", cellPad)}>
                                <span className="whitespace-nowrap block type-dense font-normal text-foreground">
                                  {(paper as any).language || (paper.extraFields as any)?.language || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.extra && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-mono text-11 text-foreground" title={extraDisplay}>
                                  {extraDisplay}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.collection && activeFilter !== 'unfiled' && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground" title={collection?.name || 'Unfiled'}>
                                  {collection?.name || 'Unfiled'}
                                </span>
                              </td>
                            )}

                            {isProjectScope && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground" title={addedByName}>
                                  {addedByName}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.dateAdded && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString() : '—'}
                              </td>
                            )}

                            {displayOptions.columns.dateModified && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.updatedAt ? new Date(paper.updatedAt).toLocaleDateString() : '—'}
                              </td>
                            )}

                            {/* Row options menu */}
                            <td
                              className={cn(
                                "w-11 px-2 text-right align-middle",
                                isCompact ? "py-0.5" : "py-1.5"
                              )}
                              onClick={(clickEvent) => clickEvent.stopPropagation()}
                            >
                              {!isPending && (
                                <div className="flex items-center justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted-foreground/20 hover:text-foreground transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                                      className="w-64 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 text-xs shadow-none space-y-0.5"
                                    >
                                      <DropdownMenuItem
                                        onClick={() => router.push(`/library/papers/${paper.id}`)}
                                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      >
                                        <BookOpen className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Open in Reader</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => window.open(`/library/papers/${paper.id}`, '_blank', 'noopener,noreferrer')}
                                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      >
                                        <ExternalLink className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Open in New Tab</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleQuickCopyCitation([paper])}
                                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      >
                                        <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Copy Citation</span>
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
                                        <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>View Details</span>
                                      </DropdownMenuItem>
                                       {canEdit && (
                                         <DropdownMenuItem
                                           onClick={() => setRetractionModalItem(paper)}
                                           className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                         >
                                           <ShieldAlert className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                           <span>{paper.isRetracted ? 'Manage Retraction' : 'Flag Retraction'}</span>
                                         </DropdownMenuItem>
                                       )}
                                       {canEdit && (
                                         <DropdownMenuItem
                                           onClick={() => setAuthorshipModalItem(paper)}
                                           className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                         >
                                           <Award className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                           <span>Manage Authorship</span>
                                         </DropdownMenuItem>
                                       )}
                                       {canEdit && currentCollectionId && (
                                         <DropdownMenuItem
                                           onClick={() => handleRemoveFromCollection(paper)}
                                           className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                         >
                                           <FolderMinus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                           <span>Remove from Collection</span>
                                         </DropdownMenuItem>
                                       )}
                                       {canEdit && (
                                         <DropdownMenuItem
                                           onClick={() => handleInitiateSingleTrash(paper)}
                                           className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-destructive focus:text-destructive rounded-md hover:bg-destructive/10 focus:bg-destructive/10 outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                                         >
                                           <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                                           <span>Move to Trash</span>
                                         </DropdownMenuItem>
                                       )}
                                     </DropdownMenuContent>
                                   </DropdownMenu>
                                 </div>
                               )}
                             </td>
                           </tr>
                         </ContextMenuTrigger>
                         {!isPending && (
                           <ContextMenuContent className="w-56 text-12 font-sans">
                             <ContextMenuItem onClick={() => router.push(`/library/papers/${paper.id}`)} className="gap-2 text-foreground">
                               <BookOpen className="size-3.5 text-foreground shrink-0" />
                               <span>Open in Reader</span>
                             </ContextMenuItem>
                             <ContextMenuItem
                               onClick={() => window.open(`/library/papers/${paper.id}`, '_blank', 'noopener,noreferrer')}
                               className="gap-2 text-foreground"
                             >
                               <ExternalLink className="size-3.5 text-foreground shrink-0" />
                               <span>Open in New Tab</span>
                             </ContextMenuItem>
                             <ContextMenuItem onClick={() => handleQuickCopyCitation([paper])} className="gap-2 text-foreground">
                               <Quote className="size-3.5 text-foreground shrink-0" />
                               <span>Copy Citation</span>
                             </ContextMenuItem>
                             <ContextMenuItem onClick={() => handleToggleStar(paper)} className="gap-2 text-foreground">
                               <Star className={cn("size-3.5 shrink-0", ((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) ? "fill-amber-400 text-amber-500" : "text-foreground")} />
                               <span>{((typeof paper.rating === 'number' && paper.rating > 0) || Boolean((paper as any).isStarred) || Boolean((paper as any).states?.[0]?.rating > 0)) ? 'Remove from Starred' : 'Add to Starred'}</span>
                             </ContextMenuItem>
                             <ContextMenuItem onClick={() => handleSelectItem(paper)} className="gap-2 text-foreground">
                               <Quote className="size-3.5 text-foreground shrink-0" />
                               <span>Cite in Inspector</span>
                             </ContextMenuItem>
                             {canEdit && (
                               <ContextMenuItem onClick={() => setAuthorshipModalItem(paper)} className="gap-2 text-foreground">
                                 <Award className="size-3.5 text-foreground shrink-0" />
                                 <span>{paper.isMyPublication ? 'Authorship Details' : 'Add to My Publications'}</span>
                               </ContextMenuItem>
                             )}
                             {canEdit && (
                               <ContextMenuItem onClick={() => setRetractionModalItem(paper)} className="gap-2 text-foreground">
                                 <ShieldAlert className="size-3.5 text-foreground shrink-0" />
                                 <span>{paper.isRetracted ? 'Retraction Details' : 'Flag as Retracted'}</span>
                               </ContextMenuItem>
                             )}
                             {canEdit && selectedIds.size >= 2 && selectedIds.has(paper.id) && (
                               <ContextMenuItem
                                 onClick={() => {
                                   const selectedItemList = sortedItems.filter((tableItem) => selectedIds.has(tableItem.id));
                                   handleOpenMerge(selectedItemList);
                                 }}
                                 className="gap-2 text-foreground"
                               >
                                 <GitMerge className="size-3.5 text-foreground shrink-0" />
                                 <span>Merge Items…</span>
                               </ContextMenuItem>
                             )}
                             {canEdit && (
                               <ContextMenuItem
                                 onClick={() => {
                                   const itemsToRename = selectedIds.has(paper.id) && selectedIds.size > 1
                                     ? sortedItems.filter((tableItem) => selectedIds.has(tableItem.id))
                                     : [paper];
                                   handleExecuteBatchRename(itemsToRename);
                                 }}
                                 className="gap-2 text-foreground"
                               >
                                 <FolderSync className="size-3.5 text-foreground shrink-0" />
                                 <span>Rename File from Parent Metadata</span>
                               </ContextMenuItem>
                             )}
                             {canEdit && currentCollectionId && (
                               <ContextMenuItem onClick={() => handleRemoveFromCollection(paper)} className="gap-2 text-foreground">
                                 <FolderMinus className="size-3.5 text-foreground shrink-0" />
                                 <span>Remove from Collection</span>
                               </ContextMenuItem>
                             )}
                             {canEdit && (
                               <ContextMenuItem onClick={() => handleInitiateSingleTrash(paper)} className="gap-2 text-destructive focus:text-destructive">
                                 <Trash2 className="size-3.5 text-destructive shrink-0" />
                                 <span>Move to Trash</span>
                               </ContextMenuItem>
                             )}
                           </ContextMenuContent>
                         )}
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
        scopeId={effectiveScopeId}
        canEdit={canEdit}
        onClose={handleCloseInspector}
        onSelectPaper={(paperId) => {
          setSelectedItemId(paperId);
          setIsInspectorOpen(true);
        }}
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
          onMinimize={actions.closeProcessModal}
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

      {/* Merge Duplicates Modal (Zotero standard) */}
      {mergeCluster && (
        <MergeModal
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          duplicates={mergeCluster}
          scopeId={effectiveScopeId || 'user'}
          onMerge={handleExecuteMerge}
        />
      )}

    </div>
  );
}
