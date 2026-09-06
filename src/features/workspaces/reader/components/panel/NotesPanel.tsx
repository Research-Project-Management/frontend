'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Edit3, Trash2, FileText, Check, X, Tag } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useNotes } from '../../hooks/use-notes';
import { noteFormSchema } from '../../schemas/reader.schema';
import type { ReaderDocument, Note, NoteFormData } from '../../types/reader.types';

interface NotesPanelProps {
  paper: ReaderDocument;
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

function NoteEditForm({
  initialContent,
  initialTitle,
  isSaving,
  onSave,
  onCancel,
}: {
  initialContent: string;
  initialTitle?: string;
  isSaving: boolean;
  onSave: (data: NoteFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      contentMd: initialContent,
      title: initialTitle,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-2 rounded-sm border border-border p-2">
      <textarea
        {...register('contentMd')}
        aria-label="Note content"
        className="w-full resize-none bg-transparent text-xs leading-relaxed outline-none focus:ring-0 text-foreground"
        rows={3}
        autoFocus
      />
      {errors.contentMd && (
        <p className="text-[11px] text-destructive">{errors.contentMd.message}</p>
      )}
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register: registerNewNote,
    handleSubmit: handleSubmitNewNote,
    reset: resetNewNote,
    setValue: setNewNoteValue,
    watch: watchNewNote,
    formState: { errors: newNoteErrors },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      contentMd: '',
      title: 'Note',
      tags: [],
    },
  });

  const currentNewNoteContent = watchNewNote('contentMd');

  useEffect(() => {
    resetNewNote();
    setEditingId(null);
    setDeletingId(null);
  }, [paper.id, resetNewNote]);

  useEffect(() => {
    if (pendingText) {
      const current = watchNewNote('contentMd') || '';
      const quote = `> "${pendingText.trim()}"\n\n`;
      setNewNoteValue('contentMd', current ? `${current}\n\n${quote}` : quote, { shouldValidate: true });
      if (onClearPendingText) onClearPendingText();
    }
  }, [pendingText, onClearPendingText, setNewNoteValue, watchNewNote]);

  const displayNotes: DisplayNote[] = React.useMemo(() => {
    const list: DisplayNote[] = (canonicalNotes || []).map((cnNote: Note) => ({
      id: cnNote.id,
      title: cnNote.title,
      content: cnNote.contentMd || '',
      tags: cnNote.tags || [],
      version: cnNote.version || 1,
      createdAt: cnNote.createdAt,
      updatedAt: cnNote.updatedAt,
      isLegacy: false,
    }));

    if (paper.notes && Array.isArray(paper.notes)) {
      paper.notes.forEach((rawNote: unknown, idx: number) => {
        const legacyContent =
          typeof rawNote === 'string'
            ? rawNote
            : typeof rawNote === 'object' && rawNote !== null
              ? String((rawNote as Record<string, unknown>).contentMd || (rawNote as Record<string, unknown>).content || '')
              : '';
        const isDuplicate = list.some((n) => n.content.trim() === legacyContent.trim());
        if (!isDuplicate && legacyContent.trim()) {
          list.push({
            id: `legacy-${idx}`,
            title: `Note ${idx + 1}`,
            content: legacyContent,
            tags: [],
            version: 1,
            isLegacy: true,
          });
        }
      });
    }

    return list;
  }, [canonicalNotes, paper.notes]);

  const handleAddNote = async (data: NoteFormData) => {
    try {
      await createNote({
        itemId: paper.id,
        title: data.title || 'Note',
        contentMd: data.contentMd.trim(),
        tags: data.tags || [],
      });
      resetNewNote();
    } catch {
      // Handled in useNotes hook
    }
  };

  const handleSaveEdit = async (data: NoteFormData) => {
    const noteToEdit = displayNotes.find((n) => n.id === editingId);
    if (!noteToEdit) return;

    try {
      if (noteToEdit.isLegacy) {
        await createNote({
          itemId: paper.id,
          title: data.title || noteToEdit.title || 'Note',
          contentMd: data.contentMd.trim(),
          tags: data.tags || noteToEdit.tags || [],
        });
      } else {
        await updateNote(noteToEdit.id, noteToEdit.version, {
          title: data.title || noteToEdit.title,
          contentMd: data.contentMd.trim(),
          tags: data.tags || noteToEdit.tags,
        });
      }
      setEditingId(null);
    } catch {
      // Handled in useNotes hook
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
    } catch {
      // Handled in useNotes hook
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
      });
    } catch {
      return dateStr;
    }
  }

  const isBusy = isCreating || isUpdating || isDeleting;

  return (
    <div className="flex h-full flex-col bg-background min-h-0">
      <div className="p-3 border-b border-border bg-background shrink-0">
        <form
          onSubmit={handleSubmitNewNote(handleAddNote)}
          className="rounded-sm border border-border bg-background focus-within:ring-1 focus-within:ring-ring p-2"
        >
          <textarea
            {...registerNewNote('contentMd')}
            aria-label="New note content"
            placeholder="Write a note or observation..."
            rows={2}
            className="w-full resize-none bg-transparent text-xs leading-relaxed outline-none placeholder:text-muted-foreground/50 text-foreground"
          />
          {newNoteErrors.contentMd && (
            <p className="text-[11px] text-destructive mt-0.5">{newNoteErrors.contentMd.message}</p>
          )}
          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={!currentNewNoteContent?.trim() || isBusy}
              className="h-6 text-xs px-2.5 font-medium cursor-pointer rounded-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            >
              {isCreating ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Plus className="size-3 mr-1" />
              )}
              Add note
            </Button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {isNotesLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayNotes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8">
            <div className="flex size-9 items-center justify-center rounded-sm border border-border bg-muted/30">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs font-medium text-foreground">No notes recorded</p>
            <p className="mt-1 max-w-[200px] text-[11px] leading-relaxed text-muted-foreground">
              Select text in the document or write notes directly above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {displayNotes.map((note) => {
              if (!note.id) return null;
              const isEditing = editingId === note.id;
              const isDeletingNote = deletingId === note.id;

              return (
                <div
                  key={note.id}
                  className="group py-2.5 first:pt-0 last:pb-0"
                >
                  {isEditing ? (
                    <NoteEditForm
                      initialContent={note.content}
                      initialTitle={note.title}
                      isSaving={isUpdating}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground select-text flex-1">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                          {isDeletingNote ? (
                            <div className="flex items-center gap-1 rounded border border-destructive/20 bg-destructive/10 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleDelete(note.id)}
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
                                onClick={() => setEditingId(note.id)}
                                className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer"
                                title="Edit note"
                                aria-label="Edit note"
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(note.id)}
                                className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors cursor-pointer"
                                title="Delete note"
                                aria-label="Delete note"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        {note.createdAt && <span>{formatNoteDate(note.createdAt)}</span>}
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex items-center gap-1 font-sans">
                            {note.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-0.5 px-1 rounded text-[10px] bg-muted text-muted-foreground"
                              >
                                <Tag className="size-2.5 opacity-60" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        )}
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
