'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Edit3,
  Trash2,
  Highlighter,
  Check,
  X,
  Search,
  FileText,
  RotateCcw,
  ArrowUpDown,
  User,
  Download,
  StickyNote,
  AlertTriangle,
  Palette,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/shared/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import { useAnnotations } from '@/features/library/sdk/queries/reader.queries';
import { annotationFormSchema } from '@/features/library/domain/types/reader.schema';
import type {
  ReaderDocument,
  ReaderAnnotation,
  AnnotationFormData,
} from '@/features/library/domain/types/reader.types';
import { PdfAnnotationEngine, ZOTERO_COLORS } from '@/features/library/domain/reader.domain';

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

const ZOTERO_COLOR_BY_HEX_MAP: ReadonlyMap<
  string,
  (typeof ZOTERO_COLORS)[number]
> = new Map(ZOTERO_COLORS.map((c) => [c.hex.toLowerCase(), c]));

function AnnotationEditForm({
  initialQuote,
  initialComment,
  initialColor,
  initialTags = [],
  isSaving,
  onSave,
  onCancel,
}: {
  initialQuote?: string;
  initialComment?: string;
  initialColor?: string;
  initialTags?: string[];
  isSaving: boolean;
  onSave: (data: AnnotationFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [tagText, setTagText] = useState((initialTags || []).join(', '));
  const form = useForm<AnnotationFormData>({
    resolver: zodResolver(annotationFormSchema),
    defaultValues: {
      quoteText: initialQuote || '',
      comment: initialComment || '',
      color: initialColor,
      tags: initialTags,
    },
  });

  const { register, handleSubmit } = form;

  const handleFormSubmit = (data: AnnotationFormData) => {
    const parsedTags = tagText
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);
    return onSave({ ...data, tags: parsedTags });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        onClick={(e) => e.stopPropagation()}
        className="space-y-2 rounded-md border border-border p-2 bg-background font-sans"
      >
        <input
          {...register('quoteText')}
          aria-label="Quote text"
          placeholder="Quote text..."
          className="w-full bg-transparent text-12 font-medium outline-none text-foreground font-sans"
        />
        <textarea
          {...register('comment')}
          aria-label="Comment"
          placeholder="Add a note/comment..."
          rows={2}
          className="w-full resize-none bg-transparent text-12 outline-none text-foreground leading-relaxed font-sans"
        />
        <input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          aria-label="Tags"
          placeholder="Tags (e.g. methodology, result)..."
          className="w-full bg-transparent text-11 font-mono outline-none text-foreground placeholder:text-muted-foreground border-t border-border-subtle pt-1"
        />
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-11 px-2.5 cursor-pointer rounded-md border-border bg-background text-foreground hover:bg-muted relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-7 text-11 px-3 font-medium cursor-pointer rounded-md relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} /> : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

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

  // Zotero behavior: Only show colors and tags that actually exist in the current paper's annotations
  const existingColors = useMemo(() => {
    const map = new Map<string, (typeof ZOTERO_COLORS)[number]>();
    for (const a of annotations) {
      const hex = (a.color || '#ffd400').toLowerCase();
      const match = ZOTERO_COLOR_BY_HEX_MAP.get(hex);
      if (match && !map.has(match.id)) {
        map.set(match.id, match);
      }
    }
    return Array.from(map.values());
  }, [annotations]);

  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of annotations) {
      if (a.tags) {
        for (const t of a.tags) {
          if (t && t.trim()) set.add(t.trim());
        }
      }
    }
    return Array.from(set);
  }, [annotations]);

  const availableAuthors = useMemo(() => {
    const set = new Set<string>();
    for (const a of annotations) {
      if (a.authorId) set.add(a.authorId);
    }
    return Array.from(set);
  }, [annotations]);

  const filteredAnnotations = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const colorLower = selectedColor === 'all' ? null : selectedColor.toLowerCase();

    const list = annotations.filter((a) => {
      if (authorFilter !== 'all' && a.authorId !== authorFilter) return false;
      if (selectedTag && (!a.tags || !a.tags.includes(selectedTag))) return false;
      if (colorLower !== null && (a.color || '#ffd400').toLowerCase() !== colorLower) {
        return false;
      }
      if (!qLower) return true;
      return Boolean(
        (a.quoteText && a.quoteText.toLowerCase().includes(qLower)) ||
          (a.comment && a.comment.toLowerCase().includes(qLower)) ||
          (a.tags && a.tags.some((t) => t.toLowerCase().includes(qLower))),
      );
    });

    if (sortBy === 'position') {
      return PdfAnnotationEngine.sortAnnotationsInReadingOrder(list);
    }

    if (sortBy === 'newest' || sortBy === 'oldest') {
      const tsMap = new Map<string, number>();
      for (const a of list) {
        const ts = Date.parse(a.createdAt);
        tsMap.set(a.id, Number.isNaN(ts) ? 0 : ts);
      }
      const dir = sortBy === 'newest' ? -1 : 1;
      return list.sort((a, b) => ((tsMap.get(a.id) ?? 0) - (tsMap.get(b.id) ?? 0)) * dir);
    }

    return list.sort((a, b) => (a.color || '').localeCompare(b.color || ''));
  }, [annotations, searchQuery, selectedColor, selectedTag, authorFilter, sortBy]);

  const handleSaveEdit = async (
    annotation: ReaderAnnotation,
    data: AnnotationFormData,
  ) => {
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
      // Handled in hook
    }
  };

  const handleDelete = async (annotation: ReaderAnnotation) => {
    if (!effectiveAttachmentId) return;
    try {
      if (onBatchDelete) {
        await onBatchDelete([annotation.id]);
      } else {
        await deleteAnnotation(annotation.id, annotation.version);
      }
      setDeletingId(null);
    } catch {
      // Handled in hook
    }
  };

  const handleJumpToPage = (pageIndex?: number, annotationId?: string) => {
    if (pageIndex !== undefined && onNavigateToPage) {
      onNavigateToPage(pageIndex + 1, annotationId);
    }
  };

  // Card click with standard Desktop Zotero multi-selection (click, Ctrl+click, Shift+click)
  const handleCardClick = (
    e: React.MouseEvent,
    annotation: ReaderAnnotation,
  ) => {
    if (editingId === annotation.id) return;

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: Toggle individual selection
      if (onToggleSelect) {
        onToggleSelect(annotation.id);
      } else if (onSelectIds) {
        const next = new Set(selectedIds);
        if (next.has(annotation.id)) next.delete(annotation.id);
        else next.add(annotation.id);
        onSelectIds(next);
      }
      setLastSelectedId(annotation.id);
    } else if (e.shiftKey && lastSelectedId) {
      // Shift+click: Range selection
      const idx1 = filteredAnnotations.findIndex((a) => a.id === lastSelectedId);
      const idx2 = filteredAnnotations.findIndex((a) => a.id === annotation.id);
      if (idx1 !== -1 && idx2 !== -1 && onSelectIds) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const rangeIds = filteredAnnotations.slice(start, end + 1).map((a) => a.id);
        const next = new Set(selectedIds);
        for (const rid of rangeIds) next.add(rid);
        onSelectIds(next);
      }
    } else {
      // Normal click: select single item and navigate to it in reader
      if (onSelectIds) {
        onSelectIds(new Set([annotation.id]));
      }
      setLastSelectedId(annotation.id);
      handleJumpToPage(annotation.pageIndex, annotation.id);
    }
  };

  // Keyboard navigation on list container (Ctrl+A to select all, Del/Backspace to delete, Esc to clear)
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      onSelectIds?.(new Set(filteredAnnotations.map((a) => a.id)));
    } else if (e.key === 'Escape') {
      onSelectIds?.(new Set());
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
      e.preventDefault();
      if (onBatchDelete) {
        onBatchDelete(Array.from(selectedIds));
      }
    }
  };

  const hasActiveFilters =
    selectedColor !== 'all' || selectedTag !== null || authorFilter !== 'all' || searchQuery.trim() !== '';

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
              {filteredAnnotations.length} of {annotations.length} highlight{annotations.length !== 1 ? 's' : ''}
            </span>

            <div className="flex items-center gap-1">
              {/* Author Filter Dropdown (if multiple authors exist) */}
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

              {/* Sort Dropdown */}
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
                  <DropdownMenuItem
                    onClick={() => setSortBy('position')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>Document Order</span>
                    {sortBy === 'position' && (
                      <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy('newest')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>Newest First</span>
                    {sortBy === 'newest' && (
                      <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy('oldest')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>Oldest First</span>
                    {sortBy === 'oldest' && (
                      <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy('color')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>By Color</span>
                    {sortBy === 'color' && (
                      <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* Selection Status Bar (shown when >= 1 selected) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border text-11 text-foreground shrink-0 animate-in fade-in duration-100">
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
              const isEditing = editingId === annotation.id;
              const isDeletingCurrent = deletingId === annotation.id;
              const isSelected = selectedIds.has(annotation.id);
              const safeColor = annotation.color || '#ffd400';

              // Target items for context menu actions
              const targetIds =
                isSelected && selectedIdsArray.length > 0
                  ? selectedIdsArray
                  : [annotation.id];

              return (
                <ContextMenu key={annotation.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleCardClick(e, annotation)}
                      onContextMenu={() => {
                        // Desktop behavior: If right-clicking an unselected item, select it
                        if (!selectedIds.has(annotation.id) && onSelectIds) {
                          onSelectIds(new Set([annotation.id]));
                          setLastSelectedId(annotation.id);
                        }
                      }}
                      className={cn(
                        'group rounded-md border p-2 text-12 transition-all relative cursor-pointer select-none outline-none',
                        isSelected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border hover:border-border-hover bg-background',
                      )}
                    >
                      {isEditing ? (
                        <AnnotationEditForm
                          initialQuote={annotation.quoteText}
                          initialComment={annotation.comment}
                          initialColor={annotation.color}
                          initialTags={annotation.tags}
                          isSaving={isUpdating}
                          onSave={(data) => handleSaveEdit(annotation, data)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <div className="space-y-1.5">
                          {/* Top row: Page tag, actions */}
                          <div className="flex items-center justify-between gap-1 text-11">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-mono text-foreground hover:underline cursor-pointer tabular-nums font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJumpToPage(annotation.pageIndex, annotation.id);
                                }}
                              >
                                P. {(annotation.pageIndex ?? 0) + 1}
                              </span>
                            </div>

                            {/* Hover actions */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                            >
                              {isDeletingCurrent ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(annotation)}
                                    aria-label="Confirm delete"
                                    className="size-6 sm:size-5 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                  >
                                    <Check className="size-3" strokeWidth={1.5} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingId(null)}
                                    aria-label="Cancel"
                                    className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                  >
                                    <X className="size-3" strokeWidth={1.5} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {onAddToNote && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onAddToNote(
                                          annotation.quoteText || annotation.comment || '',
                                          (annotation.pageIndex ?? 0) + 1,
                                        )
                                      }
                                      aria-label="Add to Note"
                                      className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      title="Add to Note"
                                    >
                                      <StickyNote className="size-3" strokeWidth={1.5} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(annotation.id)}
                                    aria-label="Edit annotation"
                                    className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                  >
                                    <Edit3 className="size-3" strokeWidth={1.5} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingId(annotation.id)}
                                    aria-label="Delete annotation"
                                    className="size-6 sm:size-5 rounded-md text-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                  >
                                    <Trash2 className="size-3" strokeWidth={1.5} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Quote Text */}
                          {annotation.quoteText && (
                            <div className="text-left w-full select-text">
                              <p
                                className="text-12 leading-snug text-foreground border-l-2 pl-2 italic"
                                style={{ borderColor: safeColor }}
                              >
                                &ldquo;{annotation.quoteText}&rdquo;
                              </p>
                            </div>
                          )}

                          {/* Comment */}
                          {annotation.comment && (
                            <p className="text-11 text-foreground pl-2 leading-relaxed select-text">
                              {annotation.comment}
                            </p>
                          )}

                          {/* Tags */}
                          {annotation.tags && annotation.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pl-2 pt-0.5">
                              {annotation.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-10 font-mono bg-background text-foreground border border-border"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </ContextMenuTrigger>

                  {/* Zotero-native Context Menu on Annotation Card */}
                  <ContextMenuContent className="w-52 text-12 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
                    <ContextMenuItem
                      onClick={() => onBatchAddToNote?.(targetIds)}
                      className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
                    >
                      <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span>
                        {targetIds.length > 1
                          ? `Add to Note (${targetIds.length})`
                          : 'Add to Note'}
                      </span>
                    </ContextMenuItem>

                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                        <Palette className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        <span>Change Color</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-36 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
                        {ZOTERO_COLORS.map((c) => (
                          <ContextMenuItem
                            key={c.id}
                            onClick={() => onBatchChangeColor?.(c.hex, targetIds)}
                            className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
                          >
                            <span
                              className="size-3 rounded-full border border-border shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span>{c.label}</span>
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuSeparator className="my-1 border-t border-border" />

                    <ContextMenuItem
                      onClick={() => onBatchDelete?.(targetIds)}
                      variant="destructive"
                      className="flex items-center gap-2 cursor-pointer text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-sm text-12"
                    >
                      <Trash2 className="size-3.5 shrink-0 text-destructive" strokeWidth={1.5} />
                      <span className="flex-1">
                        {targetIds.length > 1
                          ? `Delete ${targetIds.length} Annotations`
                          : 'Delete Annotation'}
                      </span>
                      <ContextMenuShortcut>Del</ContextMenuShortcut>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ZOTERO BOTTOM SELECTOR DOCK (#selector) ── */}
      {(existingColors.length > 1 || existingTags.length > 0) && (
        <div className="border-t border-border bg-muted p-2 space-y-1.5 shrink-0 text-11 font-sans">
          {/* Colors row: only show colors actually present in this document's annotations */}
          {existingColors.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-10 font-semibold text-muted-foreground uppercase tracking-wider">
                Colors:
              </span>
              <div className="flex items-center gap-1">
                {existingColors.map((c) => {
                  const active = selectedColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(active ? 'all' : c.hex)}
                      className={cn(
                        'size-4 rounded-full border border-border hover:scale-125 transition-transform cursor-pointer relative',
                        active && 'ring-2 ring-primary ring-offset-1 scale-110',
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={`${c.label} (${active ? 'Active' : 'Filter by this color'})`}
                    />
                  );
                })}
                {selectedColor !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedColor('all')}
                    className="text-10 text-muted-foreground hover:text-foreground cursor-pointer underline ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tags row: only show tags actually attached to annotations in this document */}
          {existingTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-10 font-semibold text-muted-foreground uppercase tracking-wider">
                Tags:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {existingTags.map((tag) => {
                  const active = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(active ? null : tag)}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-10 font-mono transition-colors cursor-pointer border',
                        active
                          ? 'bg-primary text-primary-foreground border-primary font-medium'
                          : 'bg-background border-border text-foreground hover:bg-muted',
                      )}
                    >
                      #{tag}
                    </button>
                  );
                })}
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-10 text-muted-foreground hover:text-foreground cursor-pointer underline ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnnotationsPanel;
