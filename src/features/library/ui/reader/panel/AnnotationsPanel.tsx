'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Loader2,
  AlertTriangle,
  Highlighter,
  Search,
  RotateCcw,
  Check,
  FileText,
  Download,
  User,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useAnnotations } from '@/features/library/sdk/queries/reader.queries';
import type {
  ReaderDocument,
  ReaderAnnotation,
  AnnotationFormData,
} from '@/features/library/domain/types/reader.types';
import {
  extractAnnotationFacets,
  computeRangeSelectedAnnotationIds,
  filterAndSortAnnotations,
} from './AnnotationEditForm';
import {
  AnnotationsPanelCard,
  AnnotationsBottomSelectorDock,
} from './AnnotationsPanelParts';

export { AnnotationsPanelCard, AnnotationsBottomSelectorDock };

export interface AnnotationsPanelProps {
  paper: ReaderDocument;
  scopeId?: string;
  attachmentId?: string;
  annotations?: ReaderAnnotation[];
  onNavigateToPage?: (pageNumber: number, annotationId?: string) => void;
  onAddToNote?: (text: string, pageNumber?: number) => void;
  selectedIds?: Set<string>;
  onSelectIds?: (ids: Set<string>) => void;
  onToggleSelect?: (id: string) => void;
  onBatchChangeColor?: (colorHex: string, targetIds?: string[]) => Promise<void>;
  onBatchDelete?: (targetIds?: string[]) => Promise<void>;
  onBatchAddToNote?: (targetIds?: string[]) => void;
}

const EMPTY_SELECTED_IDS = new Set<string>();

export function AnnotationsPanel({
  paper,
  scopeId,
  attachmentId,
  annotations: propAnnotations,
  onNavigateToPage,
  onAddToNote,
  selectedIds = EMPTY_SELECTED_IDS,
  onSelectIds,
  onToggleSelect,
  onBatchChangeColor,
  onBatchDelete,
  onBatchAddToNote,
}: AnnotationsPanelProps) {
  const effectiveAttachmentId =
    attachmentId || paper.attachments?.[0]?.id || paper.primaryFile?.fileId || undefined;

  const {
    annotations: queriedAnnotations,
    isLoading,
    isError,
    refetch,
    updateAnnotation,
    deleteAnnotation,
    extractNotes,
    importExternal,
    isUpdating,
    isExtracting,
    isImporting,
  } = useAnnotations(scopeId, effectiveAttachmentId);

  const annotations = propAnnotations ?? queriedAnnotations;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'position' | 'newest' | 'oldest' | 'color'>('position');
  const [authorFilter, setAuthorFilter] = useState<'all' | string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const { existingColors, existingTags, availableAuthors } = useMemo(
    () => extractAnnotationFacets(annotations),
    [annotations],
  );

  const filteredAnnotations = useMemo(
    () =>
      filterAndSortAnnotations(annotations, {
        searchQuery,
        selectedColor,
        selectedTag,
        authorFilter,
        sortBy,
      }),
    [annotations, searchQuery, selectedColor, selectedTag, authorFilter, sortBy],
  );

  const handleSaveEdit = async (annotation: ReaderAnnotation, data: AnnotationFormData) => {
    if (!effectiveAttachmentId) return;
    try {
      await updateAnnotation(annotation.id, annotation.version, {
        comment: data.comment?.trim(),
        quoteText: data.quoteText?.trim(),
        color: data.color || annotation.color,
        tags: data.tags,
      });
      setEditingId(null);
    } catch {
      /* Handled in hook */
    }
  };

  const handleDelete = async (annotation: ReaderAnnotation) => {
    if (!effectiveAttachmentId) return;
    try {
      if (onBatchDelete) await onBatchDelete([annotation.id]);
      else await deleteAnnotation(annotation.id, annotation.version);
      setDeletingId(null);
    } catch {
      /* Handled in hook */
    }
  };

  const handleJumpToPage = (pageIndex?: number, annotationId?: string) => {
    if (pageIndex !== undefined && onNavigateToPage) onNavigateToPage(pageIndex + 1, annotationId);
  };

  const handleCardClick = (e: React.MouseEvent, annotation: ReaderAnnotation) => {
    if (editingId === annotation.id) return;
    if (e.ctrlKey || e.metaKey) {
      if (onToggleSelect) onToggleSelect(annotation.id);
      else if (onSelectIds) {
        const next = new Set(selectedIds);
        if (next.has(annotation.id)) next.delete(annotation.id);
        else next.add(annotation.id);
        onSelectIds(next);
      }
      setLastSelectedId(annotation.id);
    } else if (e.shiftKey && lastSelectedId && onSelectIds) {
      const next = computeRangeSelectedAnnotationIds(
        filteredAnnotations,
        selectedIds,
        lastSelectedId,
        annotation.id,
      );
      if (next) onSelectIds(next);
    } else {
      onSelectIds?.(new Set([annotation.id]));
      setLastSelectedId(annotation.id);
      handleJumpToPage(annotation.pageIndex, annotation.id);
    }
  };

  const handleCardContextMenu = (annotation: ReaderAnnotation) => {
    if (!selectedIds.has(annotation.id) && onSelectIds) {
      onSelectIds(new Set([annotation.id]));
      setLastSelectedId(annotation.id);
    }
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      onSelectIds?.(new Set(filteredAnnotations.map((a) => a.id)));
    } else if (e.key === 'Escape') {
      onSelectIds?.(new Set());
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
      e.preventDefault();
      onBatchDelete?.(Array.from(selectedIds));
    }
  };

  const hasActiveFilters =
    selectedColor !== 'all' ||
    selectedTag !== null ||
    authorFilter !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedColor('all');
    setSelectedTag(null);
    setAuthorFilter('all');
    setSearchQuery('');
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      className="flex h-full flex-col bg-background min-h-0 select-none outline-none focus-visible:ring-0 font-sans"
    >
      {/* ── TOP HEADER: Search Bar & Actions (.sidebar-toolbar) ── */}
      {annotations.length > 0 && (
        <div className="border-b border-border p-2 bg-background space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center">
              <Search
                className="absolute left-2 size-3 text-muted-foreground pointer-events-none shrink-0"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search highlights..."
                className="h-7 w-full rounded-md border border-border bg-background pl-6 pr-6 text-11 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 flex size-4 items-center justify-center text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="size-3" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => importExternal()}
              disabled={isImporting}
              className="h-7 gap-1 px-2 text-11 font-medium rounded-md shrink-0 cursor-pointer border border-border bg-background text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Import embedded annotations from PDF (/Annots dictionary)"
            >
              {isImporting ? (
                <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} />
              ) : (
                <Download className="size-3 text-foreground shrink-0" strokeWidth={1.5} />
              )}
              <span>Import</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedIds.size > 0 && onBatchAddToNote) {
                  onBatchAddToNote(Array.from(selectedIds));
                } else {
                  extractNotes(paper.id);
                }
              }}
              disabled={isExtracting || annotations.length === 0}
              className="h-7 gap-1 px-2 text-11 font-medium rounded-md shrink-0 cursor-pointer border border-border bg-background text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title={
                selectedIds.size > 0
                  ? `Add ${selectedIds.size} selected highlights to Note`
                  : 'Extract all highlights into a Literature Note'
              }
            >
              {isExtracting ? (
                <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} />
              ) : (
                <FileText className="size-3 text-foreground shrink-0" strokeWidth={1.5} />
              )}
              <span>{selectedIds.size > 0 ? `Add (${selectedIds.size})` : 'Add to Notes'}</span>
            </Button>
          </div>

          {/* Sub-bar: Sort Menu & Count */}
          <div className="flex items-center justify-between gap-1 text-10 text-muted-foreground px-0.5">
            <span>
              {filteredAnnotations.length} of {annotations.length} highlight
              {annotations.length !== 1 ? 's' : ''}
            </span>

            <div className="flex items-center gap-1">
              {availableAuthors.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'h-5 px-1.5 flex items-center gap-1 rounded text-10 font-sans border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        authorFilter !== 'all' && 'border-primary text-primary font-medium',
                      )}
                      title="Filter by Author"
                    >
                      <User className="size-2.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span>{authorFilter === 'all' ? 'All' : 'Author'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-32 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-md z-50 font-sans"
                  >
                    <DropdownMenuItem
                      onClick={() => setAuthorFilter('all')}
                      className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                    >
                      <span>All Authors</span>
                      {authorFilter === 'all' && (
                        <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                      )}
                    </DropdownMenuItem>
                    {availableAuthors.map((aid) => (
                      <DropdownMenuItem
                        key={aid}
                        onClick={() => setAuthorFilter(aid)}
                        className="cursor-pointer text-11 flex items-center justify-between font-mono text-foreground"
                      >
                        <span className="truncate max-w-[90px]">{aid.slice(0, 8)}</span>
                        {authorFilter === aid && (
                          <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-5 px-1.5 flex items-center gap-1 rounded text-10 font-sans border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    title="Sort annotations"
                  >
                    <ArrowUpDown className="size-2.5 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="capitalize">{sortBy}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-36 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-md z-50 font-sans"
                >
                  {(
                    [
                      ['position', 'Document Order'],
                      ['newest', 'Newest First'],
                      ['oldest', 'Oldest First'],
                      ['color', 'By Color'],
                    ] as const
                  ).map(([val, label]) => (
                    <DropdownMenuItem
                      key={val}
                      onClick={() => setSortBy(val)}
                      className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                    >
                      <span>{label}</span>
                      {sortBy === val && (
                        <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* Selection Status Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border text-11 text-foreground shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="flex size-4 items-center justify-center rounded bg-primary text-10 font-semibold tabular-nums text-primary-foreground">
              {selectedIds.size}
            </span>
            <span>selected</span>
            <span className="text-muted-foreground text-10 ml-1 font-mono">(Del to delete)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectIds?.(new Set())}
              className="text-11 text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT LIST (#annotations) ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-4 animate-spin text-foreground" strokeWidth={1.5} />
          </div>
        ) : isError ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 gap-2">
            <div className="size-10 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-1">
              <AlertTriangle className="size-5 shrink-0" strokeWidth={1.5} />
            </div>
            <p className="text-13 font-semibold text-foreground">Unable to load annotations</p>
            <p className="text-12 text-muted-foreground max-w-[200px] leading-relaxed">
              Failed to load annotations for this document.
            </p>
            {refetch && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="h-7 text-11 gap-1 rounded-md border-border bg-background text-foreground hover:bg-muted cursor-pointer mt-1"
              >
                Retry
              </Button>
            )}
          </div>
        ) : !annotations || annotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="size-10 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground mb-3">
              <Highlighter className="size-5" strokeWidth={1.5} />
            </div>
            <p className="text-13 font-semibold text-foreground">No highlights yet</p>
            <p className="mt-1 text-12 text-muted-foreground max-w-[200px] leading-relaxed">
              Select any text in the PDF to highlight and add notes.
            </p>
          </div>
        ) : filteredAnnotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 gap-2">
            <div className="size-10 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground mb-1">
              <Search className="size-5" strokeWidth={1.5} />
            </div>
            <p className="text-13 font-semibold text-foreground">No matching highlights</p>
            <p className="text-12 text-muted-foreground max-w-[200px] leading-relaxed">
              No annotations match the current filters.
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 text-11 gap-1 rounded-md border-border bg-background text-foreground hover:bg-muted cursor-pointer mt-1"
              >
                <RotateCcw className="size-3" strokeWidth={1.5} />
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredAnnotations.map((annotation) => {
              const isSelected = selectedIds.has(annotation.id);
              const targetIds =
                isSelected && selectedIdsArray.length > 0
                  ? selectedIdsArray
                  : [annotation.id];

              return (
                <AnnotationsPanelCard
                  key={annotation.id}
                  annotation={annotation}
                  isEditing={editingId === annotation.id}
                  isDeletingCurrent={deletingId === annotation.id}
                  isSelected={isSelected}
                  isUpdating={isUpdating}
                  targetIds={targetIds}
                  onCardClick={handleCardClick}
                  onCardContextMenu={handleCardContextMenu}
                  onJumpToPage={handleJumpToPage}
                  onStartEdit={setEditingId}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={handleSaveEdit}
                  onStartDelete={setDeletingId}
                  onCancelDelete={() => setDeletingId(null)}
                  onConfirmDelete={handleDelete}
                  onAddToNote={onAddToNote}
                  onBatchAddToNote={onBatchAddToNote}
                  onBatchChangeColor={onBatchChangeColor}
                  onBatchDelete={onBatchDelete}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── ZOTERO BOTTOM SELECTOR DOCK (#selector) ── */}
      <AnnotationsBottomSelectorDock
        existingColors={existingColors}
        existingTags={existingTags}
        selectedColor={selectedColor}
        selectedTag={selectedTag}
        onSelectColor={setSelectedColor}
        onSelectTag={setSelectedTag}
      />
    </div>
  );
}

export default AnnotationsPanel;
