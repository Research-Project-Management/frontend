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
} from 'lucide-react';
import {
  Button,
  Form,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useAnnotations } from '../../hooks/use-annotations';
import { annotationFormSchema } from '../../schemas/reader.schema';
import type { ReaderDocument, ReaderAnnotation, AnnotationFormData } from '../../types/reader.types';

export interface AnnotationsPanelProps {
  paper: ReaderDocument;
  workspaceId: string;
  attachmentId?: string;
  onNavigateToPage?: (pageNumber: number, annotationId?: string) => void;
  onAddToNote?: (text: string, pageNumber?: number) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
}

const COLOR_FILTERS = [
  { id: 'all', label: 'All', color: '' },
  { id: 'yellow', label: 'Yellow', color: '#ffd400' },
  { id: 'red', label: 'Red', color: '#ff6666' },
  { id: 'green', label: 'Green', color: '#5fb236' },
  { id: 'blue', label: 'Blue', color: '#2ea8e5' },
  { id: 'purple', label: 'Purple', color: '#a28ae5' },
  { id: 'magenta', label: 'Magenta', color: '#e56eee' },
  { id: 'orange', label: 'Orange', color: '#f19837' },
  { id: 'gray', label: 'Gray', color: '#aaaaaa' },
] as const;

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
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-2 rounded-md border border-border p-2 bg-background shadow-2xs">
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
          className="w-full bg-transparent text-11 font-mono outline-none text-foreground placeholder:text-foreground/70 border-t border-border/40 pt-1"
        />
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-11 px-2 cursor-pointer rounded-md border-border bg-background shadow-2xs text-foreground hover:bg-muted"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-6 text-11 px-2.5 font-medium cursor-pointer rounded-md shadow-2xs"
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
  workspaceId,
  attachmentId,
  onNavigateToPage,
  onAddToNote,
  selectedIds = new Set(),
  onToggleSelect,
}: AnnotationsPanelProps) {
  const effectiveAttachmentId =
    attachmentId || paper.attachments?.[0]?.id || paper.primaryFile?.fileId;

  const {
    annotations,
    isLoading,
    updateAnnotation,
    deleteAnnotation,
    extractNotes,
    importExternal,
    isUpdating,
    isExtracting,
    isImporting,
  } = useAnnotations(workspaceId, effectiveAttachmentId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'position' | 'newest' | 'oldest' | 'color'>('position');
  const [authorFilter, setAuthorFilter] = useState<'all' | string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const availableAuthors = useMemo(() => {
    const set = new Set<string>();
    for (const a of annotations) {
      if (a.authorId) set.add(a.authorId);
    }
    return Array.from(set);
  }, [annotations]);

  const filteredAnnotations = useMemo(() => {
    const list = annotations.filter((a) => {
      const matchSearch =
        !searchQuery.trim() ||
        (a.quoteText && a.quoteText.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.comment && a.comment.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchColor =
        selectedColor === 'all' ||
        (a.color && a.color.toLowerCase() === selectedColor.toLowerCase()) ||
        (selectedColor === 'yellow' && (!a.color || a.color.toLowerCase() === 'yellow' || a.color === '#ffd400'));

      const matchAuthor =
        authorFilter === 'all' || a.authorId === authorFilter;

      return matchSearch && matchColor && matchAuthor;
    });

    return list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'color') {
        return (a.color || '').localeCompare(b.color || '');
      }
      const pA = a.pageIndex ?? 0;
      const pB = b.pageIndex ?? 0;
      if (pA !== pB) return pA - pB;
      return (a.annotationSortIndex || a.id).localeCompare(b.annotationSortIndex || b.id);
    });
  }, [annotations, searchQuery, selectedColor, authorFilter, sortBy]);

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
      await deleteAnnotation(annotation.id, annotation.version);
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

  return (
    <div className="flex h-full flex-col bg-background min-h-0 select-none">
      {/* Filter & Search Bar */}
      {annotations.length > 0 && (
        <div className="space-y-1.5 border-b border-border px-3 py-2 bg-background">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-2 size-3 text-foreground pointer-events-none shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search highlights..."
                className="h-6 w-full rounded-md border border-border bg-background pl-6 pr-6 text-11 text-foreground placeholder:text-foreground/70 shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 flex size-3.5 items-center justify-center text-foreground hover:bg-muted rounded cursor-pointer"
                >
                  <X className="size-2.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => importExternal()}
              disabled={isImporting}
              className="h-6 gap-1 px-1.5 text-11 font-medium rounded-md shrink-0 cursor-pointer border border-border bg-background shadow-2xs text-foreground hover:bg-muted"
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
              onClick={() => extractNotes(paper.id)}
              disabled={isExtracting || annotations.length === 0}
              className="h-6 gap-1 px-2 text-11 font-medium rounded-md shrink-0 cursor-pointer border border-border bg-background shadow-2xs text-foreground hover:bg-muted"
              title="Extract all highlights into a Literature Note"
            >
              {isExtracting ? (
                <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} />
              ) : (
                <FileText className="size-3 text-foreground shrink-0" strokeWidth={1.5} />
              )}
              <span>Add to Notes</span>
            </Button>
          </div>

          {/* Sub-header: Color dots, Author Filter & Sort Menu */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {/* Color Dots */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 thin-scrollbar">
              {COLOR_FILTERS.map((filter) => {
                const active = selectedColor === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setSelectedColor(filter.id)}
                    className={cn(
                      'inline-flex h-4 items-center gap-1 rounded-md px-1.5 text-10 font-medium transition-colors shrink-0 cursor-pointer shadow-2xs',
                      active
                        ? 'bg-foreground text-background font-semibold'
                        : 'bg-background border border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {filter.color && (
                      <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: filter.color }}
                      />
                    )}
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Author & Sort Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Author Filter Dropdown */}
              {availableAuthors.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "h-4.5 px-1.5 flex items-center gap-1 rounded-md text-10 font-sans border border-border bg-background shadow-2xs text-foreground hover:bg-muted cursor-pointer transition-colors",
                        authorFilter !== 'all' && "border-primary/50 text-foreground font-medium"
                      )}
                      title="Filter by Author"
                    >
                      <User className="size-2.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span>{authorFilter === 'all' ? 'All' : 'Author'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32 text-xs p-1 bg-popover border border-border shadow-2xs rounded-md">
                    <DropdownMenuItem
                      onClick={() => setAuthorFilter('all')}
                      className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                    >
                      <span>All Authors</span>
                      {authorFilter === 'all' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                    </DropdownMenuItem>
                    {availableAuthors.map((aid) => (
                      <DropdownMenuItem
                        key={aid}
                        onClick={() => setAuthorFilter(aid)}
                        className="cursor-pointer text-11 flex items-center justify-between font-mono text-foreground"
                      >
                        <span className="truncate max-w-[90px]">{aid.slice(0, 8)}</span>
                        {authorFilter === aid && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
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
                    className="h-4.5 px-1.5 flex items-center gap-1 rounded-md text-10 font-sans border border-border bg-background shadow-2xs text-foreground hover:bg-muted cursor-pointer transition-colors"
                    title="Sort annotations"
                  >
                    <ArrowUpDown className="size-2.5 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="capitalize">{sortBy}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 text-xs p-1 bg-popover border border-border shadow-2xs rounded-md">
                  <DropdownMenuItem
                    onClick={() => setSortBy('position')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>Document Order</span>
                    {sortBy === 'position' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy('newest')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>Newest First</span>
                    {sortBy === 'newest' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy('oldest')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>Oldest First</span>
                    {sortBy === 'oldest' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy('color')}
                    className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                  >
                    <span>By Color</span>
                    {sortBy === 'color' && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 thin-scrollbar">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-4 animate-spin text-foreground" strokeWidth={1.5} />
          </div>
        ) : !annotations || annotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <Highlighter className="size-6 text-foreground/40 mb-2" strokeWidth={1.5} />
            <p className="text-12 font-medium text-foreground">No highlights yet</p>
            <p className="mt-1 text-11 text-foreground/80 max-w-[200px] leading-relaxed">
              Select any text in the PDF to highlight and add notes.
            </p>
          </div>
        ) : filteredAnnotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 gap-2">
            <p className="text-12 font-medium text-foreground">No matching highlights</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchQuery(''); setSelectedColor('all'); }}
              className="h-6 text-11 gap-1 rounded-md border-border bg-background shadow-2xs text-foreground hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="size-2.5" strokeWidth={1.5} />
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredAnnotations.map((annotation) => {
              const isEditing = editingId === annotation.id;
              const isDeletingCurrent = deletingId === annotation.id;
              const isSelected = selectedIds.has(annotation.id);
              const safeColor = annotation.color || '#ffd400';

              return (
                <div
                  key={annotation.id}
                  className={cn(
                    "group rounded-md border p-2 text-12 transition-colors relative",
                    isSelected
                      ? "border-primary/60 bg-primary/5 shadow-2xs"
                      : "border-border hover:border-border/80 bg-background shadow-2xs"
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
                      {/* Top row: Checkbox, Page tag, actions */}
                      <div className="flex items-center justify-between gap-1 text-11">
                        <div className="flex items-center gap-1.5">
                          {onToggleSelect && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(annotation.id)}
                              aria-label="Select annotation"
                              className="size-3.5 rounded border-border text-primary focus:ring-0 cursor-pointer"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleJumpToPage(annotation.pageIndex, annotation.id)}
                            className="font-mono text-foreground hover:underline cursor-pointer tabular-nums font-medium"
                          >
                            P. {(annotation.pageIndex ?? 0) + 1}
                          </button>
                        </div>

                        {/* Hover actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isDeletingCurrent ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(annotation)}
                                aria-label="Confirm delete"
                                className="size-5 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                              >
                                <Check className="size-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                aria-label="Cancel"
                                className="size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
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
                                  className="size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                                  title="Add to Note"
                                >
                                  <StickyNote className="size-3" strokeWidth={1.5} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingId(annotation.id)}
                                aria-label="Edit annotation"
                                className="size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                              >
                                <Edit3 className="size-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(annotation.id)}
                                aria-label="Delete annotation"
                                className="size-5 rounded-md text-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="size-3" strokeWidth={1.5} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quote Text */}
                      {annotation.quoteText && (
                        <button
                          type="button"
                          onClick={() => handleJumpToPage(annotation.pageIndex, annotation.id)}
                          className="text-left w-full cursor-pointer select-text"
                        >
                          <p
                            className="text-12 leading-snug text-foreground border-l-2 pl-2 italic"
                            style={{ borderColor: safeColor }}
                          >
                            &ldquo;{annotation.quoteText}&rdquo;
                          </p>
                        </button>
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
                              className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-10 font-mono bg-background text-foreground border border-border shadow-2xs"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnnotationsPanel;
