'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Trash2,
  RotateCcw,
  Loader2,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import BatchBar from '../components/table/BatchBar';
import {
  type LibraryDisplayOptions,
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { useLibrary } from '../hooks/use-library';
import { useTrash, useItemTable, type SortField } from '../hooks/use-items';
import {
  normalizeAuthors,
  formatCreatorCompact,
  cleanPaperTitle,
  getPublicationVenue,
  formatItemTypeLabel,
  formatExtraDisplay,
} from '../utils/library.util';
import { ITEM_TYPE_LABELS } from '../schemas/item-type.schema';
import { sortFilterItems } from '../utils/filter.util';
import { generateCitationKey } from '../utils/bibtex.util';
import { cn } from "@/shared/lib/utils";
import type { Item } from '../types/library.types';

export default function TrashPage() {
  const { state, actions } = useLibrary();
  const {
    effectiveScopeId,
    selectedItemId,
    selectedItem,
    selectedCollection,
  } = state;

  const { setSelectedItemId } = actions;

  const [search, setSearch] = useState('');
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [singlePurgeTarget, setSinglePurgeTarget] = useState<Item | null>(null);

  const isProjectScope = state.activeScope?.type === 'project';
  const isOwner = !isProjectScope || state.activeScope?.role === 'owner';
  const canEdit =
    !isProjectScope ||
    state.activeScope?.role === 'owner' ||
    state.activeScope?.role === 'contributor';

  const searchParams = useSearchParams();
  const fileStatus = (searchParams.get('fileStatus') as any) || 'all';
  const readStatus = (searchParams.get('readStatus') as any) || 'all';
  const itemTypes = useMemo(() => {
    const raw = searchParams.getAll('type');
    if (!raw.length) return [];
    return raw
      .flatMap((t: string) => t.split(','))
      .map((t: string) => decodeURIComponent(t.trim()).toLowerCase())
      .filter(Boolean);
  }, [searchParams]);
  const fromYear = searchParams.get('fromYear') ? parseInt(searchParams.get('fromYear')!, 10) : null;
  const toYear = searchParams.get('toYear') ? parseInt(searchParams.get('toYear')!, 10) : null;
  const startDate = searchParams.get('startDate') || null;
  const endDate = searchParams.get('endDate') || null;
  const activeTags = useMemo(() => {
    const raw = searchParams.getAll('tag');
    if (!raw.length) return [];
    return raw
      .flatMap((t: string) => t.split(','))
      .map((t: string) => decodeURIComponent(t.trim()))
      .filter(Boolean);
  }, [searchParams]);
  const activeTag = activeTags.length > 0 ? activeTags.join(',') : searchParams.get('tag');

  const {
    trashItems,
    isLoading,
    restoreItem,
    purgeItem,
    emptyTrash,
    isPurging,
    isEmptyingTrash,
  } = useTrash(effectiveScopeId || 'user');

  const filteredTrashItems = useMemo(() => {
    return sortFilterItems({
      items: trashItems,
      searchQuery: search,
      activeTag,
      activeTags,
      fileStatus,
      readStatus,
      itemTypes,
      fromYear,
      toYear,
      startDate,
      endDate,
    });
  }, [
    trashItems,
    search,
    activeTag,
    activeTags,
    fileStatus,
    readStatus,
    itemTypes,
    fromYear,
    toYear,
    startDate,
    endDate,
  ]);

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
    items: filteredTrashItems,
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
  });

  const DISPLAY_OPTIONS_STORAGE_KEY = 'flux_library_display_options_v3';

  const [displayOptions, setDisplayOptions] = useState<LibraryDisplayOptions>(
    DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  );

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

  const minTableWidth = useMemo(() => {
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
    if (cols.dateAdded) width += 116;
    if (cols.dateModified) width += 116;
    return width;
  }, [displayOptions.columns]);

  const isOnlyAuthors = useMemo(() => {
    const cols = displayOptions.columns;
    const activeCount = Object.values(cols).filter(Boolean).length;
    return Boolean(cols.authors && activeCount === 1);
  }, [displayOptions.columns]);

  const isCompact = displayOptions.density === 'compact';
  const cellPad = isCompact ? "px-2.5 py-0.5" : "px-3.5 py-1.5";
  const numCellPad = isCompact ? "px-2 py-0.5" : "px-3 py-1.5";
  const thPad = isCompact ? "px-2.5 py-1" : "px-3.5 py-1";
  const numThPad = isCompact ? "px-2 py-1" : "px-3 py-1";

  const handleSelectItem = (item: Item) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const handleRowClick = (e: React.MouseEvent, item: Item) => {
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
          <ArrowDown className="size-3.5 text-foreground shrink-0" />
        ) : (
          <ArrowUp className="size-3.5 text-foreground shrink-0" />
        )}
      </span>
    );
  };

  const hasActiveFilters = fileStatus !== 'all' || readStatus !== 'all' || itemTypes.length > 0 || fromYear !== null || toYear !== null || activeTags.length > 0 || Boolean(search.trim());

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden font-sans">
      {/* Left Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Trash"
          icon={Trash2}
          search={search}
          onSearchChange={setSearch}
          scopeId={effectiveScopeId || 'user'}
          items={trashItems}
          showFilter={true}
          showDisplay={true}
          displayOptions={displayOptions}
          onDisplayOptionsChange={handleDisplayOptionsChange}
        >
          {isOwner && trashItems.length > 0 && (
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEmptyTrashDialogOpen(true)}
                    className="h-8 text-xs gap-1.5 px-3 cursor-pointer font-medium text-foreground hover:bg-muted border border-border rounded-md shadow-2xs"
                  >
                    <Trash2 className="size-3.5 text-foreground shrink-0" />
                    <span>Empty Trash</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
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
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border">
                  <Skeleton className="size-4 rounded-md" />
                  <Skeleton className="h-4 flex-1 max-w-[360px]" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : filteredTrashItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[300px] text-center p-8 select-none">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Trash2 className="size-6 text-foreground shrink-0" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {hasActiveFilters ? 'No matching items in trash' : 'Trash is empty'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {hasActiveFilters
                  ? 'No deleted references matching your filter query or search term.'
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
                  {displayOptions.columns.dateAdded && <col style={{ width: 116 }} />}
                  {displayOptions.columns.dateModified && <col style={{ width: 116 }} />}
                  <col style={{ width: 44 }} />
                </colgroup>

                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <thead className="sticky top-0 z-20 bg-background select-none border-b border-border">
                      <tr className={cn(
                        "type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground",
                        isCompact ? "h-8" : "h-9"
                      )}>
                        <th scope="col" className="w-8 pl-3 pr-1 py-1 text-left align-middle whitespace-nowrap bg-background">
                          <Checkbox
                            checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all items"
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
                          className="group/th py-1 align-middle cursor-pointer min-w-0 whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none bg-background pl-1.5 pr-3.5"
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
                              <span className="whitespace-nowrap">Item Type</span>
                              {renderSortIcon('itemType')}
                            </div>
                          </th>
                        )}
                        {displayOptions.columns.publisher && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span>Publisher</span>
                          </th>
                        )}
                        {displayOptions.columns.doi && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span>DOI</span>
                          </th>
                        )}
                        {displayOptions.columns.citationKey && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span>Citation Key</span>
                          </th>
                        )}
                        {displayOptions.columns.citations && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span>Citations</span>
                          </th>
                        )}
                        {displayOptions.columns.references && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span>References</span>
                          </th>
                        )}
                        {displayOptions.columns.pages && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span>Pages</span>
                          </th>
                        )}
                        {displayOptions.columns.volume && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span>Volume</span>
                          </th>
                        )}
                        {displayOptions.columns.issue && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span>Issue</span>
                          </th>
                        )}
                        {displayOptions.columns.edition && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", numThPad)}>
                            <span>Edition</span>
                          </th>
                        )}
                        {displayOptions.columns.language && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span>Language</span>
                          </th>
                        )}
                        {displayOptions.columns.extra && (
                          <th scope="col" className={cn("group/th py-1 align-middle whitespace-nowrap select-none", thPad)}>
                            <span>Extra</span>
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
                    const rawItemType = (paper as any).itemType || (paper as any).item_type || (paper as any).type || (paper as any).cslType;
                    const itemTypeLabel = (rawItemType && ITEM_TYPE_LABELS[rawItemType]) || formatItemTypeLabel(rawItemType);
                    const extraDisplay = formatExtraDisplay(paper);
                    const paperDoi = paper.doi || (paper.extraFields as any)?.doi || '—';
                    const citeKey = paper.citationKey || (paper as any)?.bibtexKey || generateCitationKey(paper);
                    const publicationVenue = getPublicationVenue(paper);

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            onClick={(e) => handleRowClick(e, paper)}
                            className={cn(
                              'group transition-colors cursor-pointer border-b border-border',
                              isCompact ? 'h-7.5 text-11' : 'h-9 text-12',
                              isSelected ? 'bg-muted' : isActive ? 'bg-muted' : 'hover:bg-muted',
                            )}
                          >
                            <td className={cn("w-8 pl-3 pr-1 text-left align-middle", isCompact ? "py-0.5" : "py-1.5")} onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(paper.id)}
                                aria-label={`Select ${paper.title || 'reference'}`}
                              />
                            </td>

                            <td className={cn("align-middle min-w-0 truncate pl-1.5 pr-3.5", isCompact ? "py-0.5" : "py-1.5")}>
                              <div className="flex items-center gap-2 min-w-0">
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
                                <span className="truncate block type-dense font-normal text-foreground" title={authorFull}>
                                  {authorCompact}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.year && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.year || '—'}
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
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground" title={itemTypeLabel}>
                                  {itemTypeLabel}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.publisher && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground">
                                  {paper.publisher || (paper.extraFields as any)?.publisher || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.doi && (
                              <td className={cn("align-middle truncate font-mono text-11", cellPad)}>
                                <span className="truncate block type-dense text-foreground" title={paperDoi}>
                                  {paperDoi}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.citationKey && (
                              <td className={cn("align-middle truncate font-mono text-11", cellPad)}>
                                <span className="truncate block type-dense text-foreground" title={citeKey}>
                                  {citeKey}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.citations && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {typeof paper.citationCount === 'number' ? paper.citationCount : '—'}
                              </td>
                            )}

                            {displayOptions.columns.references && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {typeof (paper as any).referenceCount === 'number' ? (paper as any).referenceCount : '—'}
                              </td>
                            )}

                            {displayOptions.columns.pages && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.pages || (paper.extraFields as any)?.pages || '—'}
                              </td>
                            )}

                            {displayOptions.columns.volume && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.volume || (paper.extraFields as any)?.volume || '—'}
                              </td>
                            )}

                            {displayOptions.columns.issue && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.issue || (paper.extraFields as any)?.issue || '—'}
                              </td>
                            )}

                            {displayOptions.columns.edition && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {(paper as any).edition || (paper.extraFields as any)?.edition || '—'}
                              </td>
                            )}

                            {displayOptions.columns.language && (
                              <td className={cn("align-middle truncate", cellPad)}>
                                <span className="truncate block type-dense font-normal text-foreground">
                                  {(paper as any).language || (paper.extraFields as any)?.language || '—'}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.extra && (
                              <td className={cn("align-middle truncate text-muted-foreground", cellPad)}>
                                <span className="truncate block type-dense font-normal" title={extraDisplay}>
                                  {extraDisplay}
                                </span>
                              </td>
                            )}

                            {displayOptions.columns.dateAdded && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString('en-US') : '—'}
                              </td>
                            )}

                            {displayOptions.columns.dateModified && (
                              <td className={cn("align-middle type-dense font-normal text-foreground tabular-nums whitespace-nowrap", numCellPad)}>
                                {paper.updatedAt ? new Date(paper.updatedAt).toLocaleDateString('en-US') : '—'}
                              </td>
                            )}

                            <td className="w-11 px-2 py-1 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                     <button
                                       type="button"
                                       className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted-foreground/20 hover:text-foreground transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary touch-manipulation"
                                       aria-label="More actions"
                                     >
                                       <MoreVertical className="size-4 text-foreground shrink-0" />
                                     </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                                    {canEdit && (
                                      <DropdownMenuItem
                                        onClick={() => handleRestoreItem(paper.id)}
                                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                                      >
                                        <RotateCcw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Restore to Library</span>
                                      </DropdownMenuItem>
                                    )}
                                    {isOwner && (
                                      <DropdownMenuItem
                                        onClick={() => setSinglePurgeTarget(paper)}
                                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                                      >
                                        <Trash2 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                        <span>Delete Permanently</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 p-1.5 text-12 font-sans rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5">
                          {canEdit && (
                            <ContextMenuItem onClick={() => handleRestoreItem(paper.id)} className="gap-2 cursor-pointer text-foreground">
                              <RotateCcw className="size-3.5 text-foreground shrink-0" />
                              <span>Restore to Library</span>
                            </ContextMenuItem>
                          )}
                          {isOwner && (
                            <ContextMenuItem onClick={() => setSinglePurgeTarget(paper)} className="gap-2 cursor-pointer text-foreground">
                              <Trash2 className="size-3.5 text-foreground shrink-0" />
                              <span>Delete Permanently</span>
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

          {/* Floating Dedicated Trash Batch Bar */}
          <BatchBar
            isTrash={true}
            selectedCount={selectedIds.size}
            selectedItems={sortedItems.filter((i) => selectedIds.has(i.id))}
            collections={[]}
            onClearSelection={clearSelection}
            onBatchRestore={canEdit ? handleBatchRestoreItems : undefined}
            onBatchDelete={isOwner ? handleBatchPurgeItems : undefined}
          />
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedItem || null}
        item={selectedItem || null}
        collection={selectedCollection || null}
        scopeId={effectiveScopeId || 'user'}
        canEdit={false}
        onClose={() => setSelectedItemId(null)}
      />

      {/* Empty Trash Confirmation Dialog */}
      <Dialog open={emptyTrashDialogOpen} onOpenChange={isPurging || isEmptyingTrash ? undefined : setEmptyTrashDialogOpen}>
        <DialogContent
          className="sm:max-w-[520px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-14 font-medium text-foreground">
                Permanently empty trash?
              </DialogTitle>
              <DialogDescription className="mt-1 text-12 text-muted-foreground leading-normal">
                Are you sure you want to permanently delete all {trashItems.length} items from the trash? This action cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmptyTrashDialogOpen(false)}
              disabled={isPurging || isEmptyingTrash}
              className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md hover:bg-muted shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEmptyTrash}
              disabled={isPurging || isEmptyingTrash}
              className="h-8 px-3 text-12 font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-none rounded-md"
            >
              {isPurging || isEmptyingTrash ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
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
          className="sm:max-w-[520px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-14 font-medium text-foreground">
                Permanently delete reference?
              </DialogTitle>
              <DialogDescription className="mt-1 text-12 text-muted-foreground leading-normal">
                Are you sure you want to permanently delete &ldquo;{singlePurgeTarget?.title || 'Untitled Reference'}&rdquo;?
                This action cannot be undone and any associated files will be removed.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSinglePurgeTarget(null)}
              disabled={isPurging}
              className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md hover:bg-muted shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => singlePurgeTarget && handlePurgeItem(singlePurgeTarget.id)}
              disabled={isPurging}
              className="h-8 px-3 text-12 font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-none rounded-md"
            >
              {isPurging ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
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
