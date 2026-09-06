'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Edit3,
  Trash2,
  Highlighter,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAnnotations } from '../../hooks/use-annotations';
import { annotationFormSchema } from '../../schemas/reader.schema';
import type { ReaderDocument, PdfAnnotation, AnnotationFormData } from '../../types/reader.types';

interface AnnotationsPanelProps {
  paper: ReaderDocument;
  workspaceId: string;
  attachmentId?: string;
}

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
    <form onSubmit={handleSubmit(onSave)} className="space-y-2 rounded-sm border border-border p-2">
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
          className="h-6 text-xs px-2 cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-6 text-xs px-2.5 font-medium cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export default function AnnotationsPanel({
  paper,
  workspaceId,
  attachmentId,
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
    isUpdating,
    isDeleting,
  } = useAnnotations(workspaceId, effectiveAttachmentId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSaveEdit = async (anno: PdfAnnotation, data: AnnotationFormData) => {
    if (!effectiveAttachmentId) return;
    try {
      await updateAnnotation(anno.id, anno.version || 1, {
        quoteText: data.quoteText?.trim() || undefined,
        comment: data.comment?.trim() || undefined,
        color: data.color || anno.color,
      });
      setEditingId(null);
    } catch {
      // Handled in useAnnotations hook
    }
  };

  const handleDelete = async (anno: PdfAnnotation) => {
    if (!effectiveAttachmentId) return;
    try {
      await deleteAnnotation(anno.id, anno.version);
      setDeletingId(null);
    } catch {
      // Handled in useAnnotations hook
    }
  };

  return (
    <div className="flex h-full flex-col bg-background min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !annotations || annotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8">
            <div className="flex size-9 items-center justify-center rounded-sm border border-border bg-muted/30">
              <Highlighter className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">No annotations</p>
            <p className="mt-1 max-w-[200px] text-[11px] leading-relaxed text-muted-foreground">
              Select text in the document and click &ldquo;Highlight&rdquo; to create annotations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {annotations.map((anno) => {
              const isEditing = editingId === anno.id;
              const isDeletingAnno = deletingId === anno.id;

              return (
                <div key={anno.id} className="group py-2.5 first:pt-0 last:pb-0">
                  {isEditing ? (
                    <AnnotationEditForm
                      initialQuote={anno.quoteText}
                      initialComment={anno.comment}
                      initialColor={anno.color}
                      isSaving={isUpdating}
                      onSave={(data) => handleSaveEdit(anno, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          {anno.quoteText && (
                            <p
                              className="text-xs text-foreground italic border-l-2 pl-2 select-text"
                              style={{ borderColor: anno.color || 'var(--primary)' }}
                            >
                              &ldquo;{anno.quoteText}&rdquo;
                            </p>
                          )}
                          {anno.comment && (
                            <p className="text-xs text-muted-foreground pl-2 select-text">
                              {anno.comment}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                          {isDeletingAnno ? (
                            <div className="flex items-center gap-1 rounded border border-destructive/20 bg-destructive/10 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleDelete(anno)}
                                title="Confirm delete"
                                aria-label="Confirm delete"
                                className="flex size-5 items-center justify-center rounded text-destructive hover:bg-destructive/20 focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors cursor-pointer"
                              >
                                <Check className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                title="Cancel"
                                aria-label="Cancel"
                                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingId(anno.id)}
                                className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer"
                                title="Edit annotation"
                                aria-label="Edit annotation"
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(anno.id)}
                                className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors cursor-pointer"
                                title="Delete annotation"
                                aria-label="Delete annotation"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-2 text-[10px] text-muted-foreground font-mono">
                        <span>p.{(anno.pageIndex ?? 0) + 1}</span>
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
