'use client';

import React, { useState } from 'react';
import {
  Loader2,
  Plus,
  Edit3,
  Trash2,
  Highlighter,
  MessageSquareQuote,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useAnnotations } from '@/features/workspaces/library/hooks/library/use-annotations';
import type { Paper, PdfAnnotation } from '@/features/workspaces/library/types/library.types';

interface AnnotationsPanelProps {
  paper: Paper;
  workspaceId: string;
  attachmentId?: string;
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
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    isCreating,
    isUpdating,
    isDeleting,
  } = useAnnotations(workspaceId, effectiveAttachmentId);

  const [isAdding, setIsAdding] = useState(false);
  const [newQuote, setNewQuote] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newPage, setNewPage] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState('');
  const [editingQuote, setEditingQuote] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!effectiveAttachmentId) {
      toast.error('No PDF attachment found for this document');
      return;
    }
    const pageNum = parseInt(newPage, 10) || 1;
    const pageIndex = Math.max(0, pageNum - 1);

    try {
      await createAnnotation({
        pageIndex,
        quoteText: newQuote.trim() || undefined,
        comment: newComment.trim() || undefined,
        type: 'highlight',
        color: '#ffeb3b',
      });
      setNewQuote('');
      setNewComment('');
      setIsAdding(false);
      toast.success('Annotation saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save annotation');
    }
  };

  const handleSaveEdit = async (anno: PdfAnnotation) => {
    if (!effectiveAttachmentId) return;
    try {
      await updateAnnotation(anno.id, anno.version || 1, {
        quoteText: editingQuote.trim() || undefined,
        comment: editingComment.trim() || undefined,
        color: anno.color,
      });
      setEditingId(null);
      setEditingComment('');
      setEditingQuote('');
      toast.success('Annotation updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update annotation');
    }
  };

  const handleDelete = async (anno: PdfAnnotation) => {
    if (!effectiveAttachmentId) return;
    try {
      await deleteAnnotation(anno.id, anno.version);
      setDeletingId(null);
      toast.success('Annotation deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete annotation');
    }
  };

  const isBusy = isCreating || isUpdating || isDeleting;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header action bar */}
      <div className="border-b border-border bg-background p-3.5 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Annotations & Highlights</h3>
          <p className="text-xs text-muted-foreground">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} on file
          </p>
        </div>
        {!isAdding && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAdding(true)}
            className="h-7 px-2.5 text-xs gap-1 cursor-pointer"
          >
            <Plus className="size-3" /> Add
          </Button>
        )}
      </div>

      {/* Add new annotation form */}
      {isAdding && (
        <div className="p-3.5 border-b border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">New Annotation</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Page:</span>
              <input
                type="number"
                min="1"
                value={newPage}
                onChange={(e) => setNewPage(e.target.value)}
                className="w-12 h-6 px-1.5 text-xs rounded border border-border bg-background text-center"
              />
            </div>
          </div>
          <textarea
            placeholder="Selected text / quote from paper..."
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs leading-relaxed outline-none focus:border-border placeholder:text-muted-foreground/50"
          />
          <textarea
            placeholder="Your notes or comments on this quote..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs leading-relaxed outline-none focus:border-border placeholder:text-muted-foreground/50"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewQuote('');
                setNewComment('');
              }}
              className="h-7 text-xs px-2.5 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={(!newQuote.trim() && !newComment.trim()) || isBusy}
              className="h-7 text-xs px-3 font-semibold cursor-pointer"
            >
              {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Annotations list */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : annotations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
              <Highlighter className="size-5 text-muted-foreground/60" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">No annotations yet</p>
            <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
              Select text in the PDF reader to highlight and attach comments, or click &ldquo;Add&rdquo; above.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {annotations.map((anno) => {
              const isEditing = editingId === anno.id;
              const isDeletingAnno = deletingId === anno.id;
              const quote = anno.quoteText || anno.quote || anno.text;
              const comment = anno.comment;
              const page = (anno.pageIndex !== undefined ? anno.pageIndex + 1 : anno.pageNumber) || 1;

              return (
                <li
                  key={anno.id}
                  className="group relative rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-border/80 space-y-2"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Quote:</div>
                      <textarea
                        value={editingQuote}
                        onChange={(e) => setEditingQuote(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none"
                      />
                      <div className="text-xs font-medium text-muted-foreground">Comment:</div>
                      <textarea
                        value={editingComment}
                        onChange={(e) => setEditingComment(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none"
                      />
                      <div className="flex justify-end gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-7 text-xs px-2.5 cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(anno)}
                          disabled={isBusy}
                          className="h-7 text-xs px-3 font-semibold cursor-pointer"
                        >
                          {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: anno.color || '#ffeb3b' }}
                          />
                          <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Page {page}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isDeletingAnno ? (
                            <div className="flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 p-0.5 animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => handleDelete(anno)}
                                title="Confirm delete"
                                className="flex size-5 items-center justify-center rounded text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                              >
                                <Check className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                title="Cancel"
                                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                                onClick={() => {
                                  setEditingId(anno.id);
                                  setEditingQuote(quote || '');
                                  setEditingComment(comment || '');
                                }}
                                title="Edit comment"
                              >
                                <Edit3 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                                onClick={() => setDeletingId(anno.id)}
                                title="Delete annotation"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {quote && (
                        <blockquote className="border-l-2 border-border pl-2 text-xs italic text-foreground/80 leading-relaxed select-text">
                          &ldquo;{quote}&rdquo;
                        </blockquote>
                      )}

                      {comment && (
                        <p className="text-xs text-foreground leading-relaxed select-text font-medium pt-0.5">
                          {comment}
                        </p>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
