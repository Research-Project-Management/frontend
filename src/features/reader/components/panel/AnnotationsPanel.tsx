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
} from 'lucide-react';
import { Button, Form } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useAnnotations } from '../../hooks/use-annotations';
import { annotationFormSchema } from '../../schemas/reader.schema';
import type { ReaderDocument, ReaderAnnotation, AnnotationFormData } from '../../types/reader.types';

export interface AnnotationsPanelProps {
  paper: ReaderDocument;
  workspaceId: string;
  attachmentId?: string;
  onNavigateToPage?: (pageNumber: number) => void;
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
  isSaving,
  onSave,
  onCancel,
}: {
  initialQuote?: string;
  initialComment?: string;
  initialColor?: string;
  isSaving: boolean;
  onSave: (data: AnnotationFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<AnnotationFormData>({
    resolver: zodResolver(annotationFormSchema),
    defaultValues: {
      quoteText: initialQuote || '',
      comment: initialComment || '',
      color: initialColor,
    },
  });

  const { register, handleSubmit } = form;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSave)} className="space-y-2 rounded-md border border-border p-2 bg-muted/20">
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
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-11 px-2 cursor-pointer rounded-md"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-6 text-11 px-2.5 font-medium cursor-pointer rounded-md"
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
    isUpdating,
    isExtracting,
  } = useAnnotations(workspaceId, effectiveAttachmentId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      const matchSearch =
        !searchQuery.trim() ||
        (a.quoteText && a.quoteText.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.comment && a.comment.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchColor =
        selectedColor === 'all' ||
        (a.color && a.color.toLowerCase() === selectedColor.toLowerCase()) ||
        (selectedColor === 'yellow' && (!a.color || a.color.toLowerCase() === 'yellow' || a.color === '#ffd400'));

      return matchSearch && matchColor;
    });
  }, [annotations, searchQuery, selectedColor]);

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

  const handleJumpToPage = (pageIndex?: number) => {
    if (pageIndex !== undefined && onNavigateToPage) {
      onNavigateToPage(pageIndex + 1);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background min-h-0 select-none">
      {/* Filter & Search Bar */}
      {annotations.length > 0 && (
        <div className="space-y-1.5 border-b border-border px-3 py-2 bg-muted/20">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-2 size-3 text-muted-foreground pointer-events-none shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search highlights..."
                className="h-6 w-full rounded-md border border-border bg-background pl-6 pr-6 text-11 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 flex size-3.5 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-2.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => extractNotes(paper.id)}
              disabled={isExtracting || annotations.length === 0}
              className="h-6 gap-1 px-2 text-11 font-medium rounded-md shrink-0 cursor-pointer border-border"
              title="Extract all highlights into a Literature Note"
            >
              {isExtracting ? (
                <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} />
              ) : (
                <FileText className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
              )}
              <span>Add to Notes</span>
            </Button>
          </div>

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
                    'inline-flex h-4 items-center gap-1 rounded-md px-1.5 text-10 font-medium transition-colors shrink-0 cursor-pointer',
                    active
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
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
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 thin-scrollbar">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : !annotations || annotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <Highlighter className="size-6 text-muted-foreground/40 mb-2" strokeWidth={1.5} />
            <p className="text-12 font-medium text-foreground">No highlights yet</p>
            <p className="mt-1 text-11 text-muted-foreground max-w-[200px] leading-relaxed">
              Select any text in the PDF to highlight and add notes.
            </p>
          </div>
        ) : filteredAnnotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 gap-2">
            <p className="text-12 text-muted-foreground">No matching highlights</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchQuery(''); setSelectedColor('all'); }}
              className="h-6 text-11 gap-1 rounded-md border-border cursor-pointer"
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
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 hover:border-border bg-card"
                  )}
                >
                  {isEditing ? (
                    <AnnotationEditForm
                      initialQuote={annotation.quoteText}
                      initialComment={annotation.comment}
                      initialColor={annotation.color}
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
                            onClick={() => handleJumpToPage(annotation.pageIndex)}
                            className="font-mono text-muted-foreground hover:text-foreground cursor-pointer tabular-nums"
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
                                className="size-5 rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                              >
                                <X className="size-3" strokeWidth={1.5} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingId(annotation.id)}
                                aria-label="Edit annotation"
                                className="size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
                              >
                                <Edit3 className="size-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(annotation.id)}
                                aria-label="Delete annotation"
                                className="size-5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer"
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
                          onClick={() => handleJumpToPage(annotation.pageIndex)}
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
                        <p className="text-11 text-muted-foreground pl-2 leading-relaxed select-text">
                          {annotation.comment}
                        </p>
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
