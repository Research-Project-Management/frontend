'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import {
  Button,
  Checkbox,
  Input,
} from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import type { Item, RelatedItem } from '@/features/library/types/library.types';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

/**
 * Normalizes broken hyphens and irregular whitespace frequently introduced
 * by GROBID / PDF extraction pipelines (e.g. "Real- Time" -> "Real-Time", "Large -Scale" -> "Large-Scale", "U -Net" -> "U-Net").
 */
function cleanAcademicText(text?: string | null): string {
  if (!text) return '';
  return text
    // Replace all unicode dashes/hyphens (en-dash, em-dash, non-breaking hyphen) flanked by whitespace between words
    .replace(/(\b[A-Za-z0-9]+)\s*[-‐‑‒–—−]\s*([A-Za-z0-9]+\b)/g, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filter list of known PDF OCR / extraction junk tokens.
 */
const JUNK_AUTHOR_PATTERNS = [
  /^\s*a\s*b\s*s\s*t\s*r\s*a\s*c\s*t\b/i,
  /^\s*i\s*n\s*t\s*r\s*o\s*d\s*u\s*c\s*t\s*i\s*o\s*n\b/i,
  /^\s*c\s*o\s*n\s*c\s*l\s*u\s*s\s*i\s*o\s*n\b/i,
  /^\s*m\s*e\s*t\s*h\s*o\s*d\b/i,
  /^\s*r\s*e\s*s\s*u\s*l\s*t\s*s\b/i,
  /^\s*r\s*e\s*f\s*e\s*r\s*e\s*n\s*c\s*e\s*s\b/i,
  /^\s*d\s*i\s*s\s*c\s*u\s*s\s*s\s*i\s*o\s*n\b/i,
  /^\s*e\s*m\s*p\s*i\s*r\s*i\s*c\s*a\s*l\b/i,
  /^\s*b\s*a\s*c\s*k\s*g\s*r\s*o\s*u\s*n\s*d\b/i,
  /^\s*a\s*c\s*k\s*n\s*o\s*w\s*l\s*e\s*d\s*g/i,
  /\b(imagenet|neural networks?|deep learning|image segmentation|convolutional)\b/i,
  /\b(university|department|faculty|laboratory|institute|proceedings|conference|ieee|arxiv)\b/i,
  /^\s*table\s+\d+/i,
  /^\s*figure\s+\d+/i,
  /^\s*vol\.\s*\d+/i,
  /^\s*no\.\s*\d+/i,
  /^\s*pp\.\s*\d+/i,
];

/**
 * Filters and formats academic authors cleanly (e.g. "Simonyan & Zisserman" or "Ronneberger et al.")
 */
function formatAcademicAuthors(authors?: string[] | null, maxAuthors = 2): string {
  if (!authors || !Array.isArray(authors) || authors.length === 0) {
    return '';
  }

  // Filter out noisy OCR tokens
  const cleanAuthors = authors
    .map((a) => cleanAcademicText(a))
    .filter((a) => {
      if (!a || a.length < 2 || a.length > 50) return false;
      return !JUNK_AUTHOR_PATTERNS.some((pattern) => pattern.test(a));
    });

  if (cleanAuthors.length === 0) return '';
  if (cleanAuthors.length === 1) return cleanAuthors[0];
  if (cleanAuthors.length === 2) return `${cleanAuthors[0]}, ${cleanAuthors[1]}`;

  return `${cleanAuthors.slice(0, maxAuthors).join(', ')} et al.`;
}

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
  workspaceId?: string;
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
  workspaceId,
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
    workspaceId ||
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

  const relatedList: RelatedItem[] = relatedItems;

  // Compute reference counts for each collection
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const all = allItemsRes?.items || [];
    for (const it of all) {
      if (it.collectionId) {
        counts[it.collectionId] = (counts[it.collectionId] || 0) + 1;
      }
      if (Array.isArray(it.collectionIds)) {
        for (const cid of it.collectionIds) {
          counts[cid] = (counts[cid] || 0) + 1;
        }
      }
      if (Array.isArray(it.collections)) {
        for (const c of it.collections) {
          if (c?.id) {
            counts[c.id] = (counts[c.id] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [allItemsRes?.items]);

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

  const isAllSelected =
    availableItems.length > 0 && selectedTargetIds.size === availableItems.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTargetIds(new Set());
    } else {
      setSelectedTargetIds(new Set(availableItems.map((i) => i.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedTargetIds(new Set());
  };

  const handleLinkConfirm = useCallback(async () => {
    if (selectedTargetIds.size === 0 || isLinking) return;
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
      toast.success(`Successfully linked ${targets.length} ${targets.length === 1 ? 'reference' : 'references'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to link items');
    }
  }, [selectedTargetIds, isLinking, link, setModalOpen]);

  const handleUnlink = async (targetItemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await unlink({ targetItemId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to unlink item');
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
    <div className="space-y-2 text-12 min-w-0">
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
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Add related item"
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
        <div className="divide-y divide-border border border-border rounded-md overflow-hidden bg-transparent">
          {relatedList.map((item) => {
            const cleanTitle = cleanAcademicText(item.title) || 'Untitled Item';
            const cleanAuthors = formatAcademicAuthors(item.authors);
            const venue = getPublicationVenue(item as unknown as VenueBearingItem);

            return (
              <div
                key={item.id}
                className="px-[8px] py-[5px] min-h-[34px] hover:bg-muted flex items-center justify-between gap-[8px] group cursor-pointer transition-colors"
                onClick={() => onSelectPaper?.(item.id)}
                title={cleanTitle}
              >
                <div className="flex items-start gap-[8px] min-w-0 flex-1">
                  <div className="size-4 shrink-0 flex items-center justify-center pt-0.5">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-normal text-foreground break-words leading-snug text-12 group-hover:underline">
                      {cleanTitle}
                    </p>
                    {(cleanAuthors || venue || item.year) && (
                      <p className="text-11 text-muted-foreground break-words leading-snug mt-0.5">
                        {[cleanAuthors, venue, item.year].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {item.doi && (
                    <a
                      href={`https://doi.org/${encodeURIComponent(item.doi)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                      title={`Open DOI: ${item.doi}`}
                      aria-label="Open DOI"
                    >
                      <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.5} />
                    </a>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => handleUnlink(item.id, e)}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted invisible group-hover:visible cursor-pointer transition-colors"
                      title="Unlink item"
                      aria-label="Unlink item"
                    >
                      <X className="size-3.5 shrink-0" strokeWidth={1.5} />
                    </button>
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
          className="sm:max-w-[780px] w-[95vw] bg-background text-foreground p-0 gap-0 border border-border rounded-xl shadow-raised-200 overflow-hidden flex flex-col h-[580px] max-h-[85vh]"
        >
          {/* Header - No icon box */}
          <DialogHeader className="px-5 py-3.5 border-b border-border/80 space-y-1 bg-background shrink-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Add Related References
            </DialogTitle>
            <DialogDescription className="text-11 text-muted-foreground leading-normal flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">Linking with:</span>
              <span
                className="font-medium text-foreground truncate max-w-[540px]"
                title={currentPaperCleanTitle}
              >
                &ldquo;{currentPaperCleanTitle}&rdquo;
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Body: Left Sidebar (Collections) + Right Main Panel (References) */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Sidebar: Collections */}
            <div className="w-48 sm:w-52 shrink-0 border-r border-border bg-muted/20 flex flex-col min-h-0 select-none">
              <div className="px-3 pt-3 pb-1.5 flex items-center justify-between text-11 font-medium text-muted-foreground">
                <span>Collections</span>
                <span className="text-10 text-muted-foreground/70 font-mono">
                  {collections.length + 1}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 thin-scrollbar">
                {/* All Items Option */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('all')}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 rounded-md text-12 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none',
                    selectedCollectionFilter === 'all'
                      ? 'bg-muted text-foreground font-medium shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <Library className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate">All Items</span>
                  </div>
                  <span className="text-10 font-mono text-muted-foreground/80 shrink-0 tabular-nums">
                    {allItemsRes?.items?.length || 0}
                  </span>
                </button>

                {/* Individual Collections */}
                {collections.map((col: any) => {
                  const isSelected = selectedCollectionFilter === col.id;
                  const count = collectionCounts[col.id] ?? col.itemCount ?? null;

                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setSelectedCollectionFilter(col.id)}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-md text-12 flex items-center justify-between gap-2 cursor-pointer transition-colors select-none',
                        isSelected
                          ? 'bg-muted text-foreground font-medium shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                      title={col.name}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <Folder
                          className="size-3.5 shrink-0"
                          style={{ color: col.color || 'var(--muted-foreground)' }}
                          strokeWidth={1.5}
                        />
                        <span className="truncate">{col.name}</span>
                      </div>
                      {count !== null && (
                        <span className="text-10 font-mono text-muted-foreground/80 shrink-0 tabular-nums">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Main Panel: Full Search + References List */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
              {/* Full Width Search Bar */}
              <div className="px-4 py-2 border-b border-border/60 bg-muted/10 flex items-center gap-2 shrink-0">
                <div className="relative flex-1 flex items-center">
                  <Search
                    className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none shrink-0"
                    strokeWidth={1.5}
                  />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, author, venue, year..."
                    className="w-full pl-8 pr-7 text-12 bg-background text-foreground placeholder:text-muted-foreground rounded-md border-border h-8 shadow-2xs focus-visible:ring-1 focus-visible:ring-ring"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Clear search"
                    >
                      <X className="size-3" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>

              {/* Selection Status & Batch Toolbar */}
              <div className="px-4 py-1.5 border-b border-border/40 flex items-center justify-between text-11 text-muted-foreground bg-background select-none shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={availableItems.length === 0}
                    className="text-foreground hover:underline cursor-pointer font-medium disabled:opacity-40"
                  >
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  <span>•</span>
                  <span className="tabular-nums">
                    {availableItems.length} available
                  </span>
                </div>

                {selectedTargetIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium bg-muted px-1.5 py-0.5 rounded text-11 tabular-nums">
                      {selectedTargetIds.size} selected
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable References List */}
              <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0 thin-scrollbar space-y-1">
                {availableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2 text-center px-4">
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-12 font-medium text-foreground">No references available</p>
                      <p className="text-11 text-muted-foreground max-w-[280px]">
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
                        className="h-7 text-11 mt-1 shadow-2xs"
                      >
                        Reset filters
                      </Button>
                    )}
                  </div>
                ) : (
                  availableItems.map((targetItem: Item) => {
                    const isChecked = selectedTargetIds.has(targetItem.id);
                    const cleanTitle = cleanAcademicText(targetItem.title) || 'Untitled Reference';
                    const cleanAuthors = formatAcademicAuthors(targetItem.authors);
                    const venue = getPublicationVenue(targetItem);

                    return (
                      <div
                        key={targetItem.id}
                        onClick={() => handleToggleSelect(targetItem.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-12 flex items-center gap-3 cursor-pointer transition-colors duration-150 select-none group',
                          isChecked
                            ? 'bg-muted text-foreground'
                            : 'text-foreground hover:bg-muted/60',
                        )}
                      >
                        {/* Checkbox with click propagation stop */}
                        <div
                          className="shrink-0 flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleSelect(targetItem.id)}
                            className="size-4 rounded border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            aria-label={`Select ${cleanTitle}`}
                          />
                        </div>

                        {/* Document Icon */}
                        <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-foreground group-hover:bg-muted transition-colors">
                          <FileText className="size-3.5" strokeWidth={1.5} />
                        </div>

                        {/* Middle: Clean Title & Metadata */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p
                            className={cn(
                              'font-medium text-12 leading-snug line-clamp-1 break-words',
                              isChecked ? 'text-foreground font-semibold' : 'text-foreground',
                            )}
                            title={cleanTitle}
                          >
                            {cleanTitle}
                          </p>

                          <div className="flex items-center gap-1.5 text-11 text-muted-foreground truncate">
                            {cleanAuthors ? (
                              <span className="truncate">{cleanAuthors}</span>
                            ) : (
                              <span className="italic text-muted-foreground/70">Unknown authors</span>
                            )}
                            {venue && (
                              <>
                                <span className="shrink-0 text-muted-foreground/50">•</span>
                                <span className="truncate shrink-0 font-medium text-muted-foreground/90">{venue}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: Year Badge (Monospace tabular) */}
                        {targetItem.year && (
                          <div className="shrink-0 pl-2">
                            <span className="font-mono text-11 text-muted-foreground tabular-nums bg-muted px-1.5 py-0.5 rounded border border-border/50">
                              {targetItem.year}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions across full modal width */}
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-11 text-muted-foreground">
              {selectedTargetIds.size > 0 ? (
                <span className="text-foreground font-medium">
                  Linking {selectedTargetIds.size} {selectedTargetIds.size === 1 ? 'reference' : 'references'} bidirectionally
                </span>
              ) : (
                'Select references above to link'
              )}
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-12 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md"
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
                className="h-8 px-4 text-12 cursor-pointer font-medium rounded-md shadow-2xs flex items-center gap-1.5"
              >
                {isLinking && <Loader2 className="size-3.5 animate-spin shrink-0" strokeWidth={1.5} />}
                <span>
                  {isLinking
                    ? 'Linking...'
                    : selectedTargetIds.size > 1
                    ? `Link (${selectedTargetIds.size}) Items`
                    : 'Link Item'}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
