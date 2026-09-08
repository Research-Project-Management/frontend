'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { MinusCircle, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { normalizeNotes, type NormalizedNote } from '@/features/workspaces/library/utils/library.util';
import { useNotes } from '@/features/workspaces/library/hooks/use-notes';
import { cn } from '@/shared/lib/utils';
import type { Paper } from '@/features/workspaces/library/types/library.types';

export interface NotesSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
  onAddNote?: (content: string) => void;
  onDeleteNote?: (noteId: string, noteContent?: string) => void;
  onRequestDelete?: (note: { id: string; content: string }) => void;
  onUpdateNote?: (noteId: string, content: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
}

export function NoteIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      className={cn('shrink-0 text-muted-foreground/80', className)}
      strokeWidth="1.2"
    >
      <path
        d="M3.5 2.5h6l3 3V13.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z"
        fill="white"
        className="dark:fill-background"
      />
      <path d="M9.5 2.5V5.5H12.5" />
      <line x1="3" y1="2.5" x2="9.5" y2="2.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function NotesSection({
  paper,
  onAddNote,
  onDeleteNote,
  onRequestDelete,
  onUpdateNote,
  hideHeader = false,
  forceAdding = false,
}: NotesSectionProps) {
  const paperId = paper.id;
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (forceAdding) {
      setIsAdding(true);
    }
  }, [forceAdding]);

  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const {
    notes: canonicalNotes,
    createNote,
    updateNote,
    deleteNote,
  } = useNotes(paper.workspaceId || '', paper.id);

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
      (typeof paper.extra === 'string' && paper.extra.includes('"comment"')
        ? (() => {
            try {
              const parsedExtraPayload: unknown = JSON.parse(paper.extra);
              if (
                typeof parsedExtraPayload === 'object' &&
                parsedExtraPayload !== null &&
                'comment' in parsedExtraPayload
              ) {
                return String((parsedExtraPayload as Record<string, unknown>).comment);
              }
              return null;
            } catch (caughtError) {
              return null;
            }
          })()
        : null);

    if (typeof potentialCommentText === 'string' && potentialCommentText.trim()) {
      return [
        {
          id: `imported-comment-${paper.id}`,
          content: `Comment: ${potentialCommentText.trim()}`,
          createdAt: paper.createdAt || new Date().toISOString(),
        },
      ];
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

    if (paper.workspaceId) {
      try {
        await createNote({ itemId: paper.id, contentMd: trimmedContent });
      } catch (caughtError) {
        if (onAddNote) onAddNote(trimmedContent);
      }
    } else if (onAddNote) {
      onAddNote(trimmedContent);
    }
    setNewNoteContent('');
    setIsAdding(false);
  };

  const handleStartEdit = (selectedNote: NormalizedNote) => {
    setEditingNoteId(selectedNote.id);
    setEditingContent(selectedNote.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    const trimmedContent = editingContent.trim();
    if (!trimmedContent) return;

    const targetNote = canonicalNotes.find((singleNote) => singleNote.id === noteId);
    if (targetNote && paper.workspaceId) {
      try {
        await updateNote(noteId, targetNote.version || 1, { contentMd: trimmedContent });
      } catch (caughtError) {
        if (onUpdateNote) onUpdateNote(noteId, trimmedContent);
      }
    } else if (paper.workspaceId) {
      try {
        await createNote({ itemId: paper.id, contentMd: trimmedContent });
      } catch (caughtError) {
        if (onAddNote) onAddNote(trimmedContent);
      }
    } else if (onUpdateNote) {
      onUpdateNote(noteId, trimmedContent);
    }
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };



  return (
    <div className="space-y-1 min-w-0 font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-medium text-foreground">
            Notes
          </h3>
        </div>
      )}

      {/* Add New Note Box */}
      {isAdding && (
        <div className="space-y-1.5 p-2 bg-muted rounded-md border border-border text-xs mb-1.5">
          <Textarea
            autoFocus
            placeholder="Write a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={2}
            className="text-xs resize-none w-full max-h-36 overflow-y-auto focus:border-primary border-border bg-transparent rounded-md"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewNoteContent('');
              }}
              className="h-6 px-2 text-xs rounded-md cursor-pointer text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNewNote}
              disabled={!newNoteContent.trim()}
              className="h-6 px-2.5 text-xs rounded-md cursor-pointer font-medium"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Empty State when no notes and not adding */}
      {notes.length === 0 && !isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-foreground hover:bg-muted rounded-md border border-dashed border-border cursor-pointer"
        >
          <Plus className="size-3.5 text-foreground shrink-0" />
          <span>Add note or comment...</span>
        </button>
      )}

      {/* Flat Notes List - Matching UI in media_1788420362997.png */}
      <div className="space-y-0.5 min-w-0">
        {notes.map((n) => {
          const isEditing = editingNoteId === n.id;

          if (isEditing) {
            return (
              <div key={n.id} className="space-y-1.5 p-2 bg-muted rounded-md border border-border text-xs">
                <Textarea
                  autoFocus
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={2}
                  className="text-xs resize-none w-full max-h-36 overflow-y-auto focus:border-primary border-border bg-transparent rounded-md"
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-6 px-2 text-xs rounded-md cursor-pointer text-foreground hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(n.id)}
                    disabled={!editingContent.trim()}
                    className="h-6 px-2.5 text-xs rounded-md cursor-pointer font-medium"
                  >
                    Save
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={n.id}
              onClick={() => handleStartEdit(n)}
              className="group/note flex items-center justify-between gap-2 px-2 py-0.5 rounded-md hover:bg-muted text-xs cursor-pointer select-none min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="size-4 shrink-0 flex items-center justify-center">
                  <NoteIcon className="size-3.5 text-foreground shrink-0" />
                </div>
                <span className="truncate text-xs font-normal text-foreground tracking-tight" title={n.content}>
                  {n.content}
                </span>
              </div>

              {/* Minus circle button on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRequestDelete) {
                    onRequestDelete({ id: n.id, content: n.content });
                  } else if (onDeleteNote) {
                    onDeleteNote(n.id, n.content);
                  } else if (deleteNote && paper.workspaceId) {
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
