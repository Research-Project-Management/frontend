'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FileText, X, ExternalLink, Loader2, Search, Plus, Folder, Library, } from 'lucide-react';
import { useRelations } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import { useViewItems, useLibraryCountsQuery } from '@/features/library/sdk/queries/catalog.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
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
} from '@/shared/components/ui/dialog';
import { toast } from 'sonner';
import type { Item, RelatedItem, Collection } from '@/features/library/domain/types/library.types';
import { cn } from '@/shared/lib/utils';
import { cleanAcademicText } from '@/features/library/domain/academic-text';

interface RelatedSectionProps {
  item?: Item;
  scopeId?: string;
  onSelectItem?: (itemId: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  isAddOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
  canEdit?: boolean;
}

export default function RelatedSection(props: RelatedSectionProps) {
  const {
    item,
    scopeId,
    onSelectItem,
    hideHeader = false,
    forceAdding = false,
    isAddOpen,
    onAddOpenChange,
    canEdit = true,
  } = props;

  const activeScopeId =
    scopeId ||
    item?.projectId ||
    'user';

  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const isModalOpen = isAddOpen !== undefined ? isAddOpen : internalAddOpen;
  const setModalOpen = onAddOpenChange || setInternalAddOpen;

  // Modal State
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedSearch('');
      return;
    }
    const timerId = setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, 200);
    return () => clearTimeout(timerId);
  }, [searchQuery]);

  const { relatedItems, isLoading, link, unlink, isLinking } = useRelations(
    activeScopeId,
    item?.id || '',
  );
  const activeCollectionId =
    selectedCollectionFilter && selectedCollectionFilter !== 'all'
      ? selectedCollectionFilter
      : undefined;

  const { data: allItemsRes } = useViewItems(activeScopeId, 'all', {
    enabled: isModalOpen,
    limit: 100,
    search: debouncedSearch || undefined,
    collectionId: activeCollectionId,
  });
  const { data: collections = [] } = useCollectionsQuery(activeScopeId);
  const { data: libraryCounts } = useLibraryCountsQuery(activeScopeId);

  useEffect(() => {
    if (forceAdding && canEdit) {
      setModalOpen(true);
    }
  }, [forceAdding, canEdit, setModalOpen]);

  // Authoritative item counts from Backend
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: libraryCounts?.total ?? allItemsRes?.total ?? (allItemsRes?.items?.length || 0),
    };
    for (const col of collections) {
      counts[col.id] = col.itemCount ?? 0;
    }
    return counts;
  }, [libraryCounts?.total, allItemsRes?.total, allItemsRes?.items?.length, collections]);

  const relatedList: RelatedItem[] = relatedItems;

  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const handleItemClick = useCallback(
    (targetId: string) => {
      if (onSelectItem) {
        onSelectItem(targetId);
      } else {
        selectOnly(targetId);
      }
    },
    [onSelectItem, selectOnly],
  );

  // Filter available items for linking (excluding current item & already linked items)
  const availableItems = useMemo(() => {
    const all = allItemsRes?.items || [];
    const linkedIdSet = new Set(relatedList.map((r) => r.id));

    return all
      .filter((targetItem: Item) => {
        if (!targetItem?.id || targetItem.id === item?.id) return false;
        if (linkedIdSet.has(targetItem.id)) return false;
        return true;
      })
      .slice(0, 100);
  }, [allItemsRes?.items, relatedList, item?.id]);

  const handleToggleSelect = (id: string) => {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };


  const isSubmittingRef = useRef(false);
  const unlinkingRef = useRef<Set<string>>(new Set());

  const handleLinkConfirm = useCallback(async () => {
    if (selectedTargetIds.size === 0 || isLinking || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const targets = Array.from(selectedTargetIds);

    try {
      await link({
        targetItemIds: targets,
        relationType: 'related',
      });

      setSelectedTargetIds(new Set());
      setSearchQuery('');
      setSelectedCollectionFilter('all');
      setModalOpen(false);
    } catch (err) {
      toast.error('Failed to link items', { id: 'related-link-error' });
    } finally {
      isSubmittingRef.current = false;
    }
  }, [selectedTargetIds, isLinking, link, setModalOpen]);

  const handleUnlink = async (targetItemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (unlinkingRef.current.has(targetItemId)) return;
    unlinkingRef.current.add(targetItemId);
    try {
      await unlink({ targetItemId });
    } catch (err) {
      toast.error('Failed to unlink item', { id: 'related-unlink-error' });
    } finally {
      unlinkingRef.current.delete(targetItemId);
    }
  };

  // Keyboard shortcut listener inside the modal
  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedTargetIds.size > 0 && !isLinking) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      handleLinkConfirm();
    }
  };

  if (!isLoading && relatedList.length === 0 && !isModalOpen && !canEdit) {
    return null;
  }

  if (!item) {
    return null;
  }

  const currentPaperCleanTitle = cleanAcademicText(item.title) || 'Current Reference';

  return (
    <div className="flex flex-col gap-2 text-12 min-w-0">
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-12 font-medium text-foreground">
            Related
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
              aria-label="Add related item"
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-3 text-center text-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-3.5 animate-spin shrink-0" strokeWidth={1.5} />
          <span className="text-11">Loading related items...</span>
        </div>
      )}

      {/* Relations list in Inspector */}
      {!isLoading && relatedList.length > 0 && (
        <div className="flex flex-col gap-2">
          {relatedList.map((relItem) => {
            const cleanTitle = cleanAcademicText(relItem.title) || 'Untitled Item';

            return (
              <div
                key={relItem.id}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(relItem.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(relItem.id);
                  }
                }}
                className="group relative flex items-start gap-2 p-2 rounded-md border border-border bg-card hover:bg-muted hover:border-border transition-all cursor-pointer select-none"
              >
                {/* Left document icon - neutral, does not change color on hover */}
                <div className="size-6 rounded bg-muted text-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                </div>

                {/* Main reference info - paper title only */}
                <div className="min-w-0 flex-1 pr-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="font-medium text-12 text-foreground leading-snug line-clamp-2">
                        {cleanTitle}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>{cleanTitle}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Top-right action controls - pushed to the right, clean neutral colors */}
                <div
                  className="flex items-center gap-0.5 shrink-0 ml-auto -mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Open DOI */}
                  {relItem.doi && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://doi.org/${encodeURIComponent(relItem.doi)}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="size-6 flex items-center justify-center rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
                          aria-label={`Open DOI: ${relItem.doi}`}
                        >
                          <ExternalLink className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end" sideOffset={4}>
                        Open DOI
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Unlink */}
                  {canEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => handleUnlink(relItem.id, e)}
                          className="size-6 flex items-center justify-center rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
                          aria-label="Unlink reference"
                        >
                          <X className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end" sideOffset={4}>
                        Unlink reference
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Two-Column Master-Detail "Add Related Items" Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          onKeyDown={handleDialogKeyDown}
          className="sm:max-w-[780px] w-full sm:w-[95vw] h-[92vh] sm:h-[580px] max-h-[92vh] sm:max-h-[85vh] bg-background text-foreground p-0 gap-0 border border-border rounded-xl shadow-raised-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <DialogHeader className="px-5 py-3.5 border-b border-border bg-background space-y-1 shrink-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Add Related References
            </DialogTitle>
            <DialogDescription className="text-11 text-muted-foreground leading-normal flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 text-muted-foreground">Linking with:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium text-foreground truncate max-w-[500px]">
                    &ldquo;{currentPaperCleanTitle}&rdquo;
                  </span>
                </TooltipTrigger>
                <TooltipContent>{currentPaperCleanTitle}</TooltipContent>
              </Tooltip>
            </DialogDescription>
          </DialogHeader>

          {/* Body: Responsive Layout - Top Filter Strip on Mobile, Left Sidebar on Desktop */}
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            {/* Collections: Horizontal scroll on mobile, Left Sidebar on desktop */}
            <div className="w-full sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border-subtle bg-muted flex flex-col min-h-0 select-none">
              <div className="px-3 pt-2.5 pb-1 sm:pt-3 sm:pb-1.5 text-11 font-medium text-foreground flex items-center justify-between">
                <span>Collections</span>
                <span className="sm:hidden text-10 text-muted-foreground">Swipe to filter</span>
              </div>

              <div className="flex flex-row sm:flex-col overflow-x-auto sm:overflow-y-auto p-1.5 gap-1 sm:gap-0.5 thin-scrollbar shrink-0">
                {/* All Items Option */}
                <button
                  type="button"
                  aria-pressed={selectedCollectionFilter === 'all'}
                  onClick={() => setSelectedCollectionFilter('all')}
                  className={cn(
                    'text-left px-2.5 py-1.5 rounded-md text-12 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none shrink-0 sm:shrink sm:w-full',
                    selectedCollectionFilter === 'all'
                      ? 'bg-background text-foreground font-medium border border-border-subtle'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                    <Library className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
                    <span className="truncate">All Items</span>
                  </div>
                  {collectionCounts.all > 0 && (
                    <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0 ml-1">
                      {collectionCounts.all}
                    </span>
                  )}
                </button>

                {/* Individual Collections */}
                {collections.map((col: Collection) => {
                  const isSelected = selectedCollectionFilter === col.id;
                  const count = collectionCounts[col.id] || 0;

                  return (
                    <Tooltip key={col.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedCollectionFilter(col.id)}
                          className={cn(
                            'text-left px-2.5 py-1.5 rounded-md text-12 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none shrink-0 sm:shrink sm:w-full',
                            isSelected
                              ? 'bg-background text-foreground font-medium border border-border-subtle'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal',
                          )}
                          aria-label={`${col.name} (${count} items)`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                            <Folder
                              className="size-3.5 shrink-0 text-foreground"
                              strokeWidth={1.5}
                            />
                            <span className="truncate">{col.name}</span>
                          </div>
                          {count > 0 && (
                            <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0 ml-1">
                              {count}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{col.name}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            {/* Right Main Panel: Command Search + Inset Divider + References List */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
              {/* Seamless Command Search Bar */}
              <div className="px-3.5 pt-3 pb-2 flex items-center shrink-0">
                <div className="relative w-full max-w-md flex items-center">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                    strokeWidth={1.5}
                  />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, author, venue, year..."
                    aria-label="Search references"
                    className="w-full h-8.5 pl-9 pr-9 text-13 rounded-lg border border-border bg-background hover:border-border-hover focus:border-primary text-foreground placeholder:text-muted-foreground outline-none transition-all shadow-none"
                  />
                  {searchQuery && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-1 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors rounded-md"
                          aria-label="Clear search"
                        >
                          <X className="size-3.5" strokeWidth={1.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Clear search</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Inset non-touching divider line between search and list */}
              <Separator className="mx-3.5 shrink-0" />

              {/* Scrollable References List with live region */}
              <div
                role="region"
                aria-label="Available references list"
                aria-live="polite"
                className="flex-1 overflow-y-auto px-2.5 py-2 min-h-0 thin-scrollbar"
              >
                {availableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-foreground space-y-2 text-center px-4">
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="size-4 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-12 font-medium text-foreground">No references available</p>
                      <p className="text-12 text-foreground max-w-[280px]">
                        {searchQuery || selectedCollectionFilter !== 'all'
                          ? 'No items match your search in this collection.'
                          : 'All available items in this collection are already linked.'}
                      </p>
                    </div>
                    {(searchQuery || selectedCollectionFilter !== 'all') && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCollectionFilter('all');
                        }}
                        className="h-7 text-12 mt-1"
                      >
                        Reset filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {availableItems.map((targetItem: Item, index: number) => {
                      const isChecked = selectedTargetIds.has(targetItem.id);
                      const cleanTitle = cleanAcademicText(targetItem.title) || 'Untitled Reference';

                      return (
                        <React.Fragment key={targetItem.id}>
                          {index > 0 && <div className="mx-3 my-0.5 border-b border-border-subtle" />}
                          <label
                            className={cn(
                              'group relative w-full text-left px-3 py-2 rounded-md text-13 flex items-center gap-2.5 cursor-pointer transition-colors duration-150 select-none focus-within:ring-1 focus-within:ring-ring',
                              isChecked
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-muted text-foreground',
                            )}
                          >
                            {/* Checkbox with direct binding */}
                            <div className="shrink-0 flex items-center">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => handleToggleSelect(targetItem.id)}
                                className="size-4 rounded border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                aria-label={`Select ${cleanTitle}`}
                              />
                            </div>

                            {/* Title only */}
                            <div className="min-w-0 flex-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p
                                    className={cn(
                                      'text-13 leading-snug line-clamp-1 break-words',
                                      isChecked ? 'font-medium text-primary' : 'font-normal text-foreground',
                                    )}
                                  >
                                    {cleanTitle}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>{cleanTitle}</TooltipContent>
                              </Tooltip>
                            </div>

                            {/* Right: Year Badge */}
                            {targetItem.year ? (
                              <div className="shrink-0 pl-2">
                                <span className="px-1.5 py-0.5 rounded text-11 font-mono text-muted-foreground bg-muted border border-border-subtle tabular-nums">
                                  {targetItem.year}
                                </span>
                              </div>
                            ) : null}
                          </label>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions across full modal width */}
          <div className="px-5 py-3 border-t border-border bg-background flex items-center justify-end gap-2 shrink-0 select-none">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-none"
              onClick={() => {
                setModalOpen(false);
                setSelectedTargetIds(new Set());
                setSearchQuery('');
                setSelectedCollectionFilter('all');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={selectedTargetIds.size === 0 || isLinking}
              onClick={handleLinkConfirm}
              className="h-8 px-4 text-12 font-medium rounded-md cursor-pointer shadow-none flex items-center gap-1.5 disabled:opacity-50 disabled:bg-muted disabled:text-foreground disabled:border-transparent disabled:pointer-events-none"
            >
              {isLinking && <Loader2 className="size-3.5 animate-spin shrink-0" strokeWidth={1.5} />}
              <span>
                {isLinking
                  ? 'Linking...'
                  : selectedTargetIds.size > 0
                  ? `Link ${selectedTargetIds.size} ${selectedTargetIds.size === 1 ? 'Reference' : 'References'}`
                  : 'Link References'}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


