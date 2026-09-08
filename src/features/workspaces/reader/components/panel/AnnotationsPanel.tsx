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
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAnnotations } from '../../hooks/use-annotations';
import { annotationFormSchema } from '../../schemas/reader.schema';
import { PdfAnnotationEngine } from '../../utils/reader.util';
import type { ReaderDocument, ReaderAnnotation, AnnotationFormData } from '../../types/reader.types';

interface AnnotationsPanelProps {
  paper: ReaderDocument;
  workspaceId: string;
  attachmentId?: string;
  onNavigateToPage?: (pageNumber: number) => void;
}

const COLOR_FILTERS = [
  { id: 'all', label: 'All', color: '' },
  { id: 'yellow', label: 'Yellow', color: '#eab308' },
  { id: 'emerald', label: 'Green', color: '#10b981' },
  { id: 'sky', label: 'Blue', color: '#0ea5e9' },
  { id: 'purple', label: 'Purple', color: '#a855f7' },
  { id: 'rose', label: 'Pink', color: '#f43f5e' },
  { id: 'amber', label: 'Orange', color: '#f97316' },
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
  const { register, handleSubmit } = useForm<AnnotationFormData>({
    resolver: zodResolver(annotationFormSchema),
    defaultValues: {
      quoteText: initialQuote || '',
      comment: initialComment || '',
      color: initialColor,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-2 rounded-md border border-border p-2">
      <input
        {...register('quoteText')}
        aria-label="Quote text"
        placeholder="Quote text..."
        className="w-full bg-transparent text-xs outline-none text-foreground"
      />
      <textarea
        {...register('comment')}
        aria-label="Comment"
        placeholder="Comment..."
        rows={2}
        className="w-full resize-none bg-transparent text-xs outline-none text-foreground leading-relaxed"
      />
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2 cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-6 text-xs px-2.5 font-medium cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="size-3 animate-spin shrink-0" /> : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export default function AnnotationsPanel({
  paper,
  workspaceId,
  attachmentId,
  onNavigateToPage,
}: AnnotationsPanelProps) {
  const effectiveAttachmentId =
    attachmentId ||
    paper.attachments?.[0]?.id ||
    paper.primaryFile?.fileId ||
    undefined;

  const {
    annotations,
    isLoading,
    updateAnnotation,
    deleteAnnotation,
    extractNotes,
    isExtracting,
    isUpdating,
  } = useAnnotations(workspaceId, effectiveAttachmentId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('all');

  const filteredAnnotations = useMemo(() => {
    return PdfAnnotationEngine.filterAnnotations(
      annotations || [],
      searchQuery,
      selectedColor,
    );
  }, [annotations, searchQuery, selectedColor]);

  const handleSaveEdit = async (annotation: ReaderAnnotation, data: AnnotationFormData) => {
    if (!effectiveAttachmentId) return;
    try {
      await updateAnnotation(annotation.id, annotation.version ?? 1, {
        quoteText: data.quoteText?.trim() || undefined,
        comment: data.comment?.trim() || undefined,
        color: data.color || annotation.color,
      });
      setEditingId(null);
    } catch {
      // Handled in useAnnotations hook
    }
  };

  const handleDelete = async (annotation: ReaderAnnotation) => {
    if (!effectiveAttachmentId) return;
    try {
      await deleteAnnotation(annotation.id, annotation.version);
      setDeletingId(null);
    } catch {
      // Handled in useAnnotations hook
    }
  };

  const handleJumpToPage = (pageIndex?: number) => {
    if (pageIndex !== undefined && onNavigateToPage) {
      onNavigateToPage(pageIndex + 1);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedColor('all');
  };

  return (
    <div className="flex h-full flex-col bg-background min-h-0">
      {/* Header Toolbar: Count & Extract Notes Action */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-11 font-medium text-foreground">
            {annotations.length} {annotations.length === 1 ? 'Annotation' : 'Annotations'}
          </span>
          {(searchQuery || selectedColor !== 'all') && (
            <span className="text-10 text-muted-foreground font-mono">
              ({filteredAnnotations.length} shown)
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => extractNotes(paper.id)}
          disabled={isExtracting || annotations.length === 0}
          className="h-6 gap-1 px-2 text-11 font-medium cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
          title="Extract all highlights into a Markdown Note"
        >
          {isExtracting ? (
            <Loader2 className="size-3 animate-spin shrink-0" />
          ) : (
            <FileText className="size-3 text-muted-foreground shrink-0" />
          )}
          <span>Extract Notes</span>
        </Button>
      </div>

      {/* Filter & Search Bar */}
      {annotations && annotations.length > 0 && (
        <div className="space-y-1.5 border-b border-border/40 px-3 py-2 bg-muted/20">
          <div className="relative flex items-center">
            <Search className="absolute left-2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotes or comments..."
              className="h-7 w-full rounded-md border border-border bg-background pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted cursor-pointer"
                title="Clear search"
              >
                <X className="size-3 shrink-0" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            {COLOR_FILTERS.map((filter) => {
              const active = selectedColor === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedColor(filter.id)}
                  className={cn(
                    'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-10 font-medium transition-colors cursor-pointer shrink-0',
                    active
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted text-muted-foreground hover:bg-muted',
                  )}
                >
                  {filter.color ? (
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: filter.color }}
                    />
                  ) : null}
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground shrink-0" />
          </div>
        ) : !annotations || annotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8">
            <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted">
              <Highlighter className="size-4 text-muted-foreground shrink-0" />
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">No annotations</p>
            <p className="mt-1 max-w-[200px] text-11 leading-relaxed text-muted-foreground">
              Select text in the document and click &ldquo;Highlight&rdquo; to create annotations.
            </p>
          </div>
        ) : filteredAnnotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8 gap-2">
            <p className="text-xs font-medium text-foreground">No matching annotations</p>
            <p className="text-11 text-muted-foreground max-w-[220px]">
              No annotations matched your search or color filter criteria.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="mt-1 h-6 gap-1 px-2.5 text-11 font-medium rounded-md cursor-pointer"
            >
              <RotateCcw className="size-3 text-muted-foreground shrink-0" />
              <span>Reset filters</span>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredAnnotations.map((annotation) => {
              const isEditing = editingId === annotation.id;
              const isDeletingCurrent = deletingId === annotation.id;
              const safeBorderColor = /^#[0-9a-f]{3,6}$/i.test(annotation.color || '')
                ? annotation.color
                : 'var(--primary)';

              return (
                <div key={annotation.id} className="group py-2.5 first:pt-0 last:pb-0">
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
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          {annotation.quoteText && (
                            <button
                              type="button"
                              onClick={() => handleJumpToPage(annotation.pageIndex)}
                              className="text-left w-full group/quote cursor-pointer"
                              title={`Jump to page ${(annotation.pageIndex ?? 0) + 1}`}
                            >
                              <p
                                className="text-xs text-foreground italic border-l-2 pl-2 select-text group-hover/quote:opacity-80 transition-opacity leading-relaxed"
                                style={{ borderColor: safeBorderColor }}
                              >
                                &ldquo;{annotation.quoteText}&rdquo;
                              </p>
                            </button>
                          )}
                          {annotation.comment && (
                            <p className="text-xs text-muted-foreground pl-2 select-text leading-relaxed">
                              {annotation.comment}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                          {isDeletingCurrent ? (
                            <div className="flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleDelete(annotation)}
                                title="Confirm delete"
                                aria-label="Confirm delete"
                                className="flex size-5 items-center justify-center rounded-md text-destructive hover:bg-destructive/20 focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors cursor-pointer"
                              >
                                <Check className="size-3.5 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                title="Cancel"
                                aria-label="Cancel"
                                className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer"
                              >
                                <X className="size-3.5 shrink-0" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingId(annotation.id)}
                                className="flex size-6 items-center justify-center rounded-md text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer hover:bg-muted"
                                title="Edit annotation"
                                aria-label="Edit annotation"
                              >
                                <Edit3 className="size-3.5 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(annotation.id)}
                                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors cursor-pointer"
                                title="Delete annotation"
                                aria-label="Delete annotation"
                              >
                                <Trash2 className="size-3.5 shrink-0" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-2 text-10 text-muted-foreground font-mono">
                        <button
                          type="button"
                          onClick={() => handleJumpToPage(annotation.pageIndex)}
                          className="inline-flex items-center gap-1 rounded px-1 -ml-1 text-10 text-muted-foreground font-mono hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          title={`Jump to page ${(annotation.pageIndex ?? 0) + 1}`}
                        >
                          <span>p.{(annotation.pageIndex ?? 0) + 1}</span>
                        </button>
                      </div>
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

