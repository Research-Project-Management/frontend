'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { MinusCircle, Plus, StickyNote } from 'lucide-react';
import { Textarea, Button } from "@/shared/components/ui";
import { normalizeNotes, type NormalizedNote } from '../../domain';
import { useNotes } from '../../data';
import { cn } from "@/shared/lib/utils";
import type { Paper } from '@/features/library/types/library.types';

export interface NotesSectionProps {
  paper: Paper;
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  onUpdatePaper?: (data: Partial<Paper>) => void;
  onAddNote?: (content: string) => void;
  onDeleteNote?: (noteId: string, noteContent?: string) => void;
  onRequestDelete?: (note: { id: string; content: string }) => void;
  onUpdateNote?: (noteId: string, content: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  onCancelAdding?: () => void;
  canEdit?: boolean;
}

export function NoteIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <StickyNote
      className={cn('size-3.5 shrink-0 text-foreground', className)}
      strokeWidth={1.5}
    />
  );
}

export default function NotesSection({
  paper,
  scopeId,
  projectId,
  workspaceId,
  onAddNote,
  onDeleteNote,
  onRequestDelete,
  onUpdateNote,
  hideHeader = false,
  forceAdding = false,
  onCancelAdding,
  canEdit = true,
}: NotesSectionProps) {
  const paperId = paper.id;
  const activeScopeId = scopeId || projectId || (paper as any)?.projectId || 'user';
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (forceAdding && canEdit) {
      setIsAdding(true);
    }
  }, [forceAdding, canEdit]);

  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const {
    notes: canonicalNotes,
    createNote,
    updateNote,
    deleteNote,
  } = useNotes(activeScopeId, paper.id);

  // Reset internal interactive state when switching papers to avoid state leakage
  useEffect(() => {
    setIsAdding(false);
    setNewNoteContent('');
    setEditingNoteId(null);
    setEditingContent('');
  }, [paperId]);

  const notes: NormalizedNote[] = useMemo(() => {
    if (canonicalNotes && canonicalNotes.length > 0) {
      return canonicalNotes.map((noteItem: any) => ({
        id: noteItem.id,
        content: noteItem.contentMd || noteItem.content || '',
        createdAt: noteItem.createdAt,
        updatedAt: noteItem.updatedAt,
      }));
    }
    const normalizedExistingNotes = normalizeNotes(paper.notes);
    if (normalizedExistingNotes.length > 0) {
      return normalizedExistingNotes;
    }

    // If no notes exist yet, surface author or arXiv comment from extra metadata as an initial imported note (Zotero convention)
    const potentialCommentText =
      (paper.extraFields?.comment as string) ||
      (typeof paper.extra === 'string'
        ? (() => {
            if (paper.extra.trim().startsWith('{')) {
              try {
                const parsedExtraPayload: unknown = JSON.parse(paper.extra);
                if (
                  typeof parsedExtraPayload === 'object' &&
                  parsedExtraPayload !== null &&
                  'comment' in parsedExtraPayload
                ) {
                  return String((parsedExtraPayload as Record<string, unknown>).comment);
                }
              } catch {
                // Not valid JSON
              }
            }
            const match = paper.extra.match(/^(?:comment|comments?):\s*(.+)$/im);
            if (match) {
              return match[1].trim();
            }
            return null;
          })()
        : null);

    if (typeof potentialCommentText === 'string' && potentialCommentText.trim()) {
      const cleanComment = potentialCommentText.trim();
      if (
        cleanComment &&
        !/^(\.{2,}|…|[-_—\s]+|null|undefined|none|n\/?a)$/i.test(cleanComment) &&
        /[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(cleanComment)
      ) {
        const stripped = cleanComment.replace(/^comments?:\s*/i, '').trim();
        const formattedContent = stripped.toLowerCase().startsWith('comment:')
          ? stripped
          : `Comment: ${stripped}`;
        return [
          {
            id: `imported-comment-${paper.id}`,
            content: formattedContent,
            createdAt: paper.createdAt || new Date().toISOString(),
          },
        ];
      }
    }

    return [];
  }, [
    canonicalNotes,
    paper.notes,
    paper.extraFields,
    paper.extra,
    paper.id,
    paper.createdAt,
  ]);

  const handleSaveNewNote = async () => {
    const trimmedContent = newNoteContent.trim();
    if (!trimmedContent) return;

    try {
      await createNote({ itemId: paper.id, contentMd: trimmedContent });
      setNewNoteContent('');
      setIsAdding(false);
      onCancelAdding?.();
    } catch (caughtError) {
      if (onAddNote) {
        onAddNote(trimmedContent);
        setNewNoteContent('');
        setIsAdding(false);
        onCancelAdding?.();
      } else {
        console.error(caughtError);
        // Keep content intact so user can retry
      }
    }
  };

  const handleStartEdit = (selectedNote: NormalizedNote) => {
    setEditingNoteId(selectedNote.id);
    setEditingContent(selectedNote.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    const trimmedContent = editingContent.trim();
    if (!trimmedContent) return;

    const targetNote = canonicalNotes.find((singleNote) => singleNote.id === noteId);
    if (targetNote) {
      try {
        await updateNote(noteId, targetNote.version || 1, { contentMd: trimmedContent });
      } catch (caughtError) {
        if (onUpdateNote) onUpdateNote(noteId, trimmedContent);
      }
    } else {
      // This is a synthetic imported note — only create a real note for known synthetic ids
      if (noteId.startsWith('imported-comment-')) {
        try {
          await createNote({ itemId: paper.id, contentMd: trimmedContent });
          // The synthetic note will disappear naturally once the real note is created
        } catch (caughtError) {
          if (onAddNote) onAddNote(trimmedContent);
        }
      }
      // Do not create a new note for unknown note IDs (silent no-op)
    }
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  if (notes.length === 0 && !isAdding && hideHeader) {
    return null;
  }

  return (
    <div className="space-y-1 min-w-0 font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">
            Notes
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Add note"
              aria-label="Add note"
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Add New Note Box */}
      {isAdding && (
        <div className="space-y-1.5 p-2.5 bg-background rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-colors text-xs mb-1.5 shadow-2xs">
          <Textarea
            autoFocus
            placeholder="Write a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                e.preventDefault();
                if (newNoteContent.trim()) {
                  handleSaveNewNote();
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsAdding(false);
                setNewNoteContent('');
                onCancelAdding?.();
              }
            }}
            rows={2}
            className="text-xs resize-none w-full max-h-36 overflow-y-auto border-0 focus-visible:ring-0 p-0 bg-transparent rounded-none outline-none shadow-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between text-10 font-normal text-muted-foreground select-none pt-1 border-t border-border font-mono">
            <span>Shift + Enter for new line</span>
            <span>Enter to save · Esc to cancel</span>
          </div>
        </div>
      )}

      {/* Flat Notes List */}
      {notes.length === 0 && !isAdding ? (
        <div className="py-2.5 px-3 text-center text-11 text-muted-foreground flex flex-col items-center justify-center gap-1.5 font-sans">
          <span>No notes for this reference.</span>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
            >
              <Plus className="size-3 text-foreground" strokeWidth={1.5} />
              <span>Add note</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-0.5 min-w-0">
        {notes.map((n) => {
          const isEditing = editingNoteId === n.id;

          if (isEditing) {
            return (
              <div key={n.id} className="space-y-1.5 p-2.5 bg-background rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors text-xs shadow-2xs">
                <Textarea
                  autoFocus
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                      e.preventDefault();
                      if (editingContent.trim()) {
                        handleSaveEdit(n.id);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelEdit();
                    }
                  }}
                  rows={2}
                  className="text-xs resize-none w-full max-h-36 overflow-y-auto border-0 focus-visible:ring-0 p-0 bg-transparent rounded-none outline-none shadow-none placeholder:text-muted-foreground"
                />
                <div className="flex items-center justify-between text-10 font-normal text-muted-foreground select-none pt-1 border-t border-border font-mono">
                  <span>Shift + Enter for new line</span>
                  <span>Enter to save · Esc to cancel</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={n.id}
              onClick={canEdit ? () => handleStartEdit(n) : undefined}
              className={cn(
                "group/note flex items-center justify-between gap-2 px-2 py-0.5 rounded-md text-xs select-none min-w-0",
                canEdit ? "hover:bg-muted cursor-pointer" : "cursor-default"
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="size-4 shrink-0 flex items-center justify-center">
                  <NoteIcon className="size-3.5 text-foreground shrink-0" />
                </div>
                <span className="text-xs font-normal text-foreground tracking-tight select-text break-words leading-snug" title={n.content}>
                  {n.content}
                </span>
              </div>

              {/* Minus circle button on hover */}
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRequestDelete) {
                      onRequestDelete({ id: n.id, content: n.content });
                    } else if (onDeleteNote) {
                      onDeleteNote(n.id, n.content);
                    } else if (deleteNote) {
                      const target = canonicalNotes.find((cn) => cn.id === n.id);
                      deleteNote(n.id, target?.version);
                    }
                  }}
                  className="invisible group-hover/note:visible size-5 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer shrink-0"
                  title="Delete note"
                  aria-label="Delete note"
                >
                  <MinusCircle className="size-3.5 text-foreground shrink-0" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
