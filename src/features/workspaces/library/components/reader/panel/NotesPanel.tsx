'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Plus, Edit3, Trash2, Calendar, FileText, Check, X, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useNotes } from '@/features/workspaces/library/hooks/library/use-notes';
import type { Paper, Note } from '@/features/workspaces/library/types/library.types';

interface NotesPanelProps {
  paper: Paper;
  workspaceId: string;
  pendingText?: string;
  onClearPendingText?: () => void;
}

interface DisplayNote {
  id: string;
  title?: string;
  content: string;
  tags?: string[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
  isLegacy: boolean;
}

export default function NotesPanel({
  paper,
  workspaceId,
  pendingText,
  onClearPendingText,
}: NotesPanelProps) {
  const {
    notes: canonicalNotes,
    isLoading: isNotesLoading,
    createNote,
    updateNote,
    deleteNote,
    isCreating,
    isUpdating,
    isDeleting,
  } = useNotes(workspaceId, paper.id);

  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNewNote('');
    setEditingId(null);
    setEditingText('');
    setDeletingId(null);
  }, [paper.id]);

  useEffect(() => {
    if (pendingText) {
      const quote = `> "${pendingText.trim()}"\n\n`;
      setNewNote((prev) => (prev ? `${prev}\n\n${quote}` : quote));
      onClearPendingText?.();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length,
          );
        }
      }, 100);
    }
  }, [pendingText, onClearPendingText]);

  // Read canonical notes first. Only fallback to paper.notes when canonical is empty.
  const displayNotes: DisplayNote[] = useMemo(() => {
    if (canonicalNotes && canonicalNotes.length > 0) {
      return canonicalNotes.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.contentMd || n.content || '',
        tags: n.tags || [],
        version: n.version || 1,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        isLegacy: false,
      }));
    }

    // Compatibility fallback for legacy paper.notes
    if (paper.notes && Array.isArray(paper.notes) && paper.notes.length > 0) {
      return paper.notes.map((n: any, idx) => {
        if (typeof n === 'string') {
          return {
            id: `legacy-${idx}`,
            content: n,
            version: 1,
            createdAt: paper.createdAt,
            updatedAt: paper.updatedAt,
            isLegacy: true,
          };
        }
        return {
          id: n.id || `legacy-${idx}`,
          title: n.title,
          content: n.content || n.contentMd || '',
          tags: n.tags || [],
          version: n.version || 1,
          createdAt: n.createdAt || paper.createdAt,
          updatedAt: n.updatedAt || paper.updatedAt,
          isLegacy: true,
        };
      });
    }

    return [];
  }, [canonicalNotes, paper.notes, paper.createdAt, paper.updatedAt]);

  const handleAddNote = async () => {
    const content = newNote.trim();
    if (!content) return;
    try {
      await createNote({
        itemId: paper.id,
        title: 'Note',
        contentMd: content,
      });
      setNewNote('');
      toast.success('Note added');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add note');
    }
  };

  const handleSaveEdit = async () => {
    const content = editingText.trim();
    if (!editingId || !content) return;

    const noteToEdit = displayNotes.find((n) => n.id === editingId);
    if (!noteToEdit) return;

    try {
      if (noteToEdit.isLegacy) {
        // Migrate legacy note edit to a real canonical note record
        await createNote({
          itemId: paper.id,
          title: noteToEdit.title || 'Note',
          contentMd: content,
          tags: noteToEdit.tags || [],
        });
      } else {
        await updateNote(noteToEdit.id, noteToEdit.version, {
          title: noteToEdit.title,
          contentMd: content,
          tags: noteToEdit.tags,
        });
      }
      setEditingId(null);
      setEditingText('');
      toast.success('Note updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update note');
    }
  };

  const handleDelete = async (noteId: string) => {
    const noteToDelete = displayNotes.find((n) => n.id === noteId);
    if (!noteToDelete) return;

    try {
      if (!noteToDelete.isLegacy) {
        await deleteNote(noteToDelete.id, noteToDelete.version);
      }
      setDeletingId(null);
      toast.success('Note deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete note');
    }
  };

  const handleNewNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddNote();
    }
  };

  const handleEditNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingText('');
    }
  };

  function formatNoteDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  const isBusy = isCreating || isUpdating || isDeleting;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Add note box */}
      <div className="border-b border-border bg-background p-3.5">
        <div className="rounded-xl border border-border bg-card p-3 transition-colors focus-within:border-border">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              New note
            </label>
            <span className="text-xs text-muted-foreground/60">⌘+Enter to save</span>
          </div>
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            onKeyDown={handleNewNoteKeyDown}
            placeholder="Capture thoughts, quotes, or questions while reading..."
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || isBusy}
              className="gap-1.5 h-8 text-xs font-semibold shadow-none cursor-pointer"
            >
              {isCreating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add Note
            </Button>
          </div>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {isNotesLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayNotes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
              <FileText className="size-5 text-muted-foreground/60" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">No notes yet</p>
            <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
              Highlight text in the paper and choose &ldquo;Note&rdquo; or jot down thoughts directly.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {displayNotes.map((note) => {
              if (!note.id) return null;
              const isEditing = editingId === note.id;
              const isDeletingNote = deletingId === note.id;

              return (
                <li
                  key={note.id}
                  className="group relative rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-border/80"
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={handleEditNoteKeyDown}
                        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors focus:ring-1 focus:ring-ring"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground/50">Esc to cancel</span>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2.5 cursor-pointer"
                            onClick={() => {
                              setEditingId(null);
                              setEditingText('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3 font-semibold cursor-pointer"
                            onClick={handleSaveEdit}
                            disabled={!editingText.trim() || isBusy}
                          >
                            {isUpdating ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {note.title && note.title !== 'Note' && note.title !== 'Untitled Note' && (
                            <h4 className="text-xs font-semibold text-foreground truncate">
                              {note.title}
                            </h4>
                          )}
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 select-text">
                            {note.content}
                          </p>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {note.tags.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-muted/60 text-muted-foreground font-medium"
                                >
                                  <Tag className="size-2.5 opacity-60" />
                                  <span>{t}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                          {isDeletingNote ? (
                            <div className="flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 p-0.5 animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => handleDelete(note.id)}
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
                                  setEditingId(note.id);
                                  setEditingText(note.content);
                                  setDeletingId(null);
                                }}
                                title="Edit note"
                              >
                                <Edit3 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                                onClick={() => setDeletingId(note.id)}
                                title="Delete note"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
                        <Calendar className="size-3" />
                        <span>{formatNoteDate(note.updatedAt || note.createdAt)}</span>
                        {note.isLegacy && (
                          <span className="ml-1.5 px-1 py-0.2 rounded bg-muted text-xs text-muted-foreground/60">
                            Legacy
                          </span>
                        )}
                      </div>
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
