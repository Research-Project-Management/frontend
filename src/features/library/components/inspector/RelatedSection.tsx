'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  X,
  ExternalLink,
  Loader2,
  Search,
  Plus,
  Folder,
  Library,
} from 'lucide-react';
import { useRelations, useViewItems, useCollections } from '../../data';
import { useLibraryViewStore } from '../../store';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/shared/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import type { Item, RelatedItem } from '@/features/library/types/library.types';
import { cn } from '@/shared/lib/utils';
import { cleanAcademicText, formatAcademicAuthors } from '../../utils';

interface VenueBearingItem {
  journal?: string;
  publicationTitle?: string;
  publisher?: string;
  arxivId?: string;
}

/**
 * Extracts publication venue, journal, or arXiv ID.
 */
function getPublicationVenue(item?: VenueBearingItem | null): string {
  if (!item) return '';
  const venue = item.journal || item.publicationTitle || item.publisher;
  if (venue) return cleanAcademicText(venue);
  if (item.arxivId) return `arXiv:${cleanAcademicText(item.arxivId)}`;
  return '';
}

interface RelatedSectionProps {
  paper: Item;
  scopeId?: string;
  projectId?: string;
  onSelectPaper?: (paperId: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  isAddOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
  canEdit?: boolean;
}

export default function RelatedSection({
  paper,
  scopeId,
  projectId,
  onSelectPaper,
  hideHeader = false,
  forceAdding = false,
  isAddOpen,
  onAddOpenChange,
  canEdit = true,
}: RelatedSectionProps) {
  const activeScopeId =
    scopeId ||
    projectId ||
    paper.projectId ||
    'user';

  const { relatedItems, isLoading, link, unlink, isLinking } = useRelations(
    activeScopeId,
    paper.id || '',
  );
  const { data: allItemsRes } = useViewItems(activeScopeId, 'all');
  const collectionsState = useCollections(activeScopeId);
  const collections = collectionsState?.state?.collections || [];

  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const isModalOpen = isAddOpen !== undefined ? isAddOpen : internalAddOpen;
  const setModalOpen = onAddOpenChange || setInternalAddOpen;

  useEffect(() => {
    if (forceAdding && canEdit) {
      setModalOpen(true);
    }
  }, [forceAdding, canEdit, setModalOpen]);

  // Modal State
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate item counts for collections
  const collectionCounts = useMemo(() => {
    const all = allItemsRes?.items || [];
    const counts: Record<string, number> = {
      all: all.length,
    };
    for (const it of all) {
      if (it.collectionId) {
        counts[it.collectionId] = (counts[it.collectionId] || 0) + 1;
      }
      if (Array.isArray(it.collections)) {
        for (const c of it.collections) {
          const cid = typeof c === 'string' ? c : (c as any)?.id;
          if (cid) counts[cid] = (counts[cid] || 0) + 1;
        }
      }
    }
    return counts;
  }, [allItemsRes?.items]);

  const relatedList: RelatedItem[] = relatedItems;

  const selectOnly = useLibraryViewStore((s) => s.selectOnly);
  const handlePaperClick = useCallback(
    (targetId: string) => {
      if (onSelectPaper) {
        onSelectPaper(targetId);
      } else {
        selectOnly(targetId);
      }
    },
    [onSelectPaper, selectOnly],
  );


  // Filter available items for linking (excluding current paper & already linked papers)
  const availableItems = useMemo(() => {
    const all = allItemsRes?.items || [];
    const linkedIdSet = new Set(relatedList.map((r) => r.id));

    return all.filter((targetItem: Item) => {
      if (!targetItem?.id || targetItem.id === paper.id) return false;
      if (linkedIdSet.has(targetItem.id)) return false;

      // Filter by Collection if selected in left sidebar
      if (selectedCollectionFilter && selectedCollectionFilter !== 'all') {
        const itemColIds = targetItem.collectionIds || [];
        const itemCols = targetItem.collections || [];
        const singleColId = targetItem.collectionId;

        const inColIds = itemColIds.includes(selectedCollectionFilter);
        const inColObjs = itemCols.some(
          (c) => c.id === selectedCollectionFilter,
        );
        const inSingle = singleColId === selectedCollectionFilter;

        if (!inColIds && !inColObjs && !inSingle) return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cleanTitle = cleanAcademicText(targetItem.title).toLowerCase();
        const rawTitle = (targetItem.title || '').toLowerCase();
        const authorMatch = (targetItem.authors || []).some((a: string) =>
          a.toLowerCase().includes(q),
        );
        const yearMatch = String(targetItem.year || '').includes(q);
        const venueMatch = getPublicationVenue(targetItem).toLowerCase().includes(q);

        if (!cleanTitle.includes(q) && !rawTitle.includes(q) && !authorMatch && !yearMatch && !venueMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allItemsRes?.items, relatedList, paper.id, selectedCollectionFilter, searchQuery]);

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
      console.error('Failed to link items:', err);
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
      console.error('Failed to unlink item:', err);
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

  // No empty state rendered when there are no related items
  if (!isLoading && relatedList.length === 0 && !isModalOpen) {
    return null;
  }

  const currentPaperCleanTitle = cleanAcademicText(paper.title) || 'Current Reference';

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
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
              aria-label="Add related item"
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-3 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-3.5 animate-spin shrink-0" strokeWidth={1.5} />
          <span className="text-11">Loading related items...</span>
        </div>
      )}

      {/* Relations list in Inspector */}
      {!isLoading && relatedList.length > 0 && (
        <TooltipProvider delayDuration={700}>
          <div className="flex flex-col gap-2">
            {relatedList.map((item) => {
              const cleanTitle = cleanAcademicText(item.title) || 'Untitled Item';

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handlePaperClick(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePaperClick(item.id);
                    }
                  }}
                  className="group relative flex items-start gap-2 p-2 rounded-md border border-border/70 bg-card hover:bg-muted/50 hover:border-border transition-all cursor-pointer select-none"
                  title={cleanTitle}
                >
                  {/* Left document icon - neutral, does not change color on hover */}
                  <div className="size-6 rounded bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="size-3.5" strokeWidth={1.5} />
                  </div>

                  {/* Main reference info - paper title only */}
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="font-medium text-12 text-foreground leading-snug line-clamp-2">
                      {cleanTitle}
                    </p>
                  </div>

                  {/* Top-right action controls - pushed to the right, clean neutral colors */}
                  <div
                    className="flex items-center gap-0.5 shrink-0 ml-auto -mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Open DOI */}
                    {item.doi && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`https://doi.org/${encodeURIComponent(item.doi)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden"
                            aria-label={`Open DOI: ${item.doi}`}
                          >
                            <ExternalLink className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" sideOffset={4} className="text-12 px-2 py-1">
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
                            onClick={(e) => handleUnlink(item.id, e)}
                            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden"
                            aria-label="Unlink reference"
                          >
                            <X className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" sideOffset={4} className="text-12 px-2 py-1">
                          Unlink reference
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* Two-Column Master-Detail "Add Related Items" Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          onKeyDown={handleDialogKeyDown}
          className="sm:max-w-[780px] w-full sm:w-[95vw] h-[92vh] sm:h-[580px] max-h-[92vh] sm:max-h-[85vh] bg-background text-foreground p-0 gap-0 border border-border rounded-xl shadow-raised-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <DialogHeader className="px-5 py-3.5 border-b border-border/60 bg-background space-y-1 shrink-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Add Related References
            </DialogTitle>
            <DialogDescription className="text-11 text-muted-foreground leading-normal flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 text-muted-foreground/80">Linking with:</span>
              <span
                className="font-medium text-foreground truncate max-w-[500px]"
                title={currentPaperCleanTitle}
              >
                &ldquo;{currentPaperCleanTitle}&rdquo;
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Body: Responsive Layout - Top Filter Strip on Mobile, Left Sidebar on Desktop */}
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            {/* Collections: Horizontal scroll on mobile, Left Sidebar on desktop */}
            <div className="w-full sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border/50 bg-muted/20 flex flex-col min-h-0 select-none">
              <div className="px-3 pt-2.5 pb-1 sm:pt-3 sm:pb-1.5 text-11 font-medium text-muted-foreground flex items-center justify-between">
                <span>Collections</span>
                <span className="sm:hidden text-10 text-muted-foreground/70">Swipe to filter</span>
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
                      ? 'bg-muted text-foreground font-medium shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                    <Library className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate">All Items</span>
                  </div>
                  {collectionCounts.all > 0 && (
                    <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0 ml-1">
                      {collectionCounts.all}
                    </span>
                  )}
                </button>

                {/* Individual Collections */}
                {collections.map((col: any) => {
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
                          ? 'bg-muted text-foreground font-medium shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal',
                      )}
                      title={col.name}
                      aria-label={`${col.name} (${count} items)`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                        <Folder
                          className="size-3.5 shrink-0"
                          style={{ color: col.color || 'var(--muted-foreground)' }}
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
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none"
                    strokeWidth={1.5}
                  />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, author, venue, year..."
                    aria-label="Search references"
                    className="w-full h-8.5 pl-9 pr-9 text-13 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/35 focus:bg-background focus:border-border text-foreground placeholder:text-muted-foreground/60 outline-none transition-all shadow-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors rounded-md"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" strokeWidth={1.5} />
                    </button>
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
                    {availableItems.map((targetItem: Item, index: number) => {
                      const isChecked = selectedTargetIds.has(targetItem.id);
                      const cleanTitle = cleanAcademicText(targetItem.title) || 'Untitled Reference';

                      return (
                        <React.Fragment key={targetItem.id}>
                          {index > 0 && <div className="mx-3 my-0.5 border-b border-border/30" />}
                          <label
                            className={cn(
                              'group relative w-full text-left px-3 py-2 rounded-md text-13 flex items-center gap-2.5 cursor-pointer transition-colors duration-150 select-none focus-within:ring-1 focus-within:ring-ring',
                              isChecked
                                ? 'bg-primary/[0.06] text-primary'
                                : 'hover:bg-muted/60 text-foreground',
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
                              <p
                                className={cn(
                                  'text-13 leading-snug line-clamp-1 break-words',
                                  isChecked ? 'font-medium text-primary' : 'font-normal text-foreground',
                                )}
                                title={cleanTitle}
                              >
                                {cleanTitle}
                              </p>
                            </div>

                            {/* Right: Year Badge */}
                            {targetItem.year ? (
                              <div className="shrink-0 pl-2">
                                <span className="px-1.5 py-0.5 rounded text-11 font-mono text-muted-foreground bg-muted/40 border border-border/30 tabular-nums">
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
          <div className="px-5 py-3 border-t border-border/60 bg-background flex items-center justify-end gap-2 shrink-0 select-none">
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
              className="h-8 px-4 text-12 font-medium rounded-md cursor-pointer shadow-none flex items-center gap-1.5 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent disabled:pointer-events-none"
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
