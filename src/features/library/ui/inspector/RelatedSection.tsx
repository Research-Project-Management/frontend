'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FileText, X, ExternalLink, Loader2, Search, Plus, Folder, Library, } from 'lucide-react';
import { useRelations } from '@/features/library/core/coordinator/saved-search-builder.coordinator';
import { useViewItems, useLibraryCountsQuery } from '@/features/library/core/coordinator/item-action.coordinator';
import { useCollectionsQuery } from '@/features/library/core/coordinator/collection.coordinator';
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
import type { Item, RelatedItem, Collection, RelationType } from '@/features/library/types/core.types';
import { cn } from '@/shared/lib/utils';
import { cleanText, formatAuthors } from '@/features/library/domain/citations.domain';

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

  if (!item) {
    return null;
  }

  if (!isLoading && relatedList.length === 0 && !isModalOpen && hideHeader) {
    return null;
  }

  const currentPaperCleanTitle = cleanText(item.title) || 'Current Reference';

  return (
    <div className="flex flex-col gap-2 text-12 min-w-0 empty:hidden">
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
        <div className="flex flex-col gap-0.5">
          {relatedList.map((relItem) => {
            const cleanTitle = cleanText(relItem.title) || 'Untitled Item';

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
                className="group flex items-center justify-between gap-1.5 min-h-[26px] px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer select-none"
              >
                {/* Left document icon + title */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="size-4 shrink-0 flex items-center justify-center">
                    <FileText
                      className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0"
                      strokeWidth={1.5}
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-12 font-normal text-foreground truncate leading-snug">
                        {cleanTitle}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top">{cleanTitle}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Right action controls - visible on hover */}
                <div
                  className="invisible group-hover:visible group-focus-within:visible focus-visible:visible max-md:visible flex items-center gap-0.5 shrink-0"
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
                          className="size-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer"
                          aria-label={`Open DOI: ${relItem.doi}`}
                        >
                          <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.5} />
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
                          className="size-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-background transition-colors cursor-pointer"
                          aria-label="Unlink reference"
                        >
                          <X className="size-3.5 shrink-0" strokeWidth={1.5} />
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
      <Dialog
        open={isModalOpen}
        onOpenChange={(v) => {
          if (isLinking) return;
          setModalOpen(v);
        }}
      >
        <DialogContent
          onKeyDown={handleDialogKeyDown}
          className="sm:max-w-[760px] w-full sm:w-[92vw] h-[85vh] sm:h-[540px] max-h-[85vh] bg-background text-foreground p-0 gap-0 border border-border rounded-xl shadow-raised-200 overflow-hidden flex flex-col"
        >
          {/* Header - Clean Zotero standard title */}
          <DialogHeader className="px-5 py-3 border-b border-border bg-background shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Select Items
            </DialogTitle>
          </DialogHeader>

          {/* Body: Two-column layout (Left: Library/Collections, Right: Search + Items List) */}
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            {/* Left Sidebar: Library & Collections */}
            <div className="w-full sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-muted/15 flex flex-col min-h-0 select-none">
              <div
                role="navigation"
                aria-label="Collections filter"
                className="flex-1 overflow-x-auto sm:overflow-y-auto p-2 gap-0.5 flex flex-row sm:flex-col thin-scrollbar shrink-0"
              >
                {/* My Library Option */}
                <button
                  type="button"
                  aria-pressed={selectedCollectionFilter === 'all'}
                  onClick={() => setSelectedCollectionFilter('all')}
                  className={cn(
                    'text-left px-2.5 py-1.5 rounded-md text-12 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none shrink-0 sm:shrink sm:w-full',
                    selectedCollectionFilter === 'all'
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-normal',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                    <Library className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate">My Library</span>
                  </div>
                  {collectionCounts.all > 0 && (
                    <span className="text-11 font-mono text-muted-foreground tabular-nums shrink-0 ml-1">
                      {collectionCounts.all}
                    </span>
                  )}
                </button>

                {/* Individual Collections */}
                {collections.map((col: Collection) => {
                  const isSelected = selectedCollectionFilter === col.id;
                  const count = collectionCounts[col.id] || 0;

                  return (
                    <button
                      key={col.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedCollectionFilter(col.id)}
                      className={cn(
                        'text-left px-2.5 py-1.5 rounded-md text-12 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none shrink-0 sm:shrink sm:w-full',
                        isSelected
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-normal',
                      )}
                      title={`${col.name} (${count} items)`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                        <Folder
                          className="size-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                        <span className="truncate">{col.name}</span>
                      </div>
                      {count > 0 && (
                        <span className="text-11 font-mono text-muted-foreground tabular-nums shrink-0 ml-1">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Main Panel: Search Bar + References List */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
              {/* Seamless Command Search Bar aligned horizontally with sidebar header */}
              <div className="h-10 px-3.5 flex items-center gap-2 border-b border-border bg-background shrink-0">
                <Search
                  className="size-3.5 text-muted-foreground shrink-0 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items by title, author, year..."
                  aria-label="Search references"
                  className="flex-1 bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none border-none h-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="size-5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded"
                    aria-label="Clear search"
                  >
                    <X className="size-3" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* Scrollable References List with live region */}
              <div
                role="region"
                aria-label="Available references list"
                aria-live="polite"
                className="flex-1 overflow-y-auto px-2.5 py-2 min-h-0 thin-scrollbar"
              >
                {availableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2 text-center px-4">
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-12 font-medium text-foreground">No references available</p>
                      <p className="text-12 text-muted-foreground max-w-[280px]">
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
                    {availableItems.map((targetItem: Item) => {
                      const isChecked = selectedTargetIds.has(targetItem.id);
                      const cleanTitle = cleanText(targetItem.title) || 'Untitled Reference';

                      const rawAuthors =
                        targetItem.authors && targetItem.authors.length > 0
                          ? targetItem.authors
                          : targetItem.creators;
                      const authorSummary = rawAuthors ? formatAuthors(rawAuthors, 2) : '';
                      const displayAuthors =
                        authorSummary && authorSummary !== '—' ? authorSummary : '';

                      return (
                        <label
                          key={targetItem.id}
                          className={cn(
                            'group w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-3 cursor-pointer transition-colors duration-150 select-none',
                            isChecked
                              ? 'bg-muted text-foreground'
                              : 'hover:bg-muted/50 text-foreground',
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

                          {/* Title & Author metadata */}
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <p
                              className={cn(
                                'text-13 leading-snug truncate',
                                isChecked ? 'font-medium text-foreground' : 'font-normal text-foreground',
                              )}
                              title={cleanTitle}
                            >
                              {cleanTitle}
                            </p>

                            {displayAuthors && (
                              <p className="text-11 text-muted-foreground truncate leading-tight mt-0.5 font-normal" title={displayAuthors}>
                                {displayAuthors}
                              </p>
                            )}
                          </div>

                          {/* Right: Clean Year Text */}
                          {targetItem.year ? (
                            <span className="shrink-0 text-12 font-mono text-muted-foreground tabular-nums select-none pl-2">
                              {targetItem.year}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions across full modal width */}
          <div className="px-5 py-2.5 border-t border-border bg-background flex items-center justify-between gap-2 shrink-0 select-none">
            <div className="text-12 text-muted-foreground">
              {selectedTargetIds.size > 0 ? (
                <span className="font-medium text-foreground">
                  {selectedTargetIds.size} {selectedTargetIds.size === 1 ? 'item' : 'items'} selected
                </span>
              ) : (
                <span className="text-11 text-muted-foreground/75">
                  {availableItems.length} {availableItems.length === 1 ? 'reference' : 'references'} available
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isLinking}
                className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-none"
                onClick={() => {
                  if (isLinking) return;
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
                className="h-8 px-4 text-12 font-medium rounded-md cursor-pointer shadow-none flex items-center gap-1.5"
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


