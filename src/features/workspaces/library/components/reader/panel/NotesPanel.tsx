'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Loader2, Plus, Edit3, Trash2, Calendar, FileText, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui";
import { usePapers } from "@/features/workspaces/library/hooks/data/use-papers";
import type { Paper, Note } from "@/features/workspaces/library/types/library.types";

interface NotesPanelProps {
  paper: Paper;
  workspaceId: string;
  pendingText?: string;
  onClearPendingText?: () => void;
}

export default function NotesPanel({
  paper,
  workspaceId,
  pendingText,
  onClearPendingText,
}: NotesPanelProps) {
  const paperService = usePapers({ workspaceId, collectionId: paper.collectionId || "" });
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNewNote("");
    setEditingId(null);
    setEditingText("");
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

  const notes: Note[] = useMemo(() => {
    return (paper.notes ?? []).map((n: any, idx) => {
      if (typeof n === 'string') {
        return {
          id: `note-${idx}`,
          content: n,
          createdAt: paper.createdAt,
          updatedAt: paper.updatedAt,
        };
      }
      return {
        id: n.id || `note-${idx}`,
        content: n.content || '',
        createdAt: n.createdAt || paper.createdAt,
        updatedAt: n.updatedAt || paper.updatedAt,
      };
    });
  }, [paper.notes, paper.createdAt, paper.updatedAt]);

  const saveNotes = useCallback(
    (
      nextNotes: Array<{
        id?: string;
        content: string;
        createdAt?: string;
        updatedAt?: string;
      }>,
      successMessage: string,
    ) => {
      const stringNotes = nextNotes.map((n) => (typeof n === 'string' ? n : n.content));
      paperService.actions.updatePaper(
        { paperId: paper.id, notes: stringNotes as any },
        { onSuccess: () => toast.success(successMessage) },
      );
    },
    [paper.id, paperService.actions.updatePaper],
  );

  const handleAddNote = () => {
    const content = newNote.trim();
    if (!content) return;
    saveNotes(
      [...notes.map(({ id, content }: Note) => ({ id, content })), { content }],
      "Note added",
    );
    setNewNote("");
  };

  const handleSaveEdit = () => {
    const content = editingText.trim();
    if (!editingId || !content) return;
    saveNotes(
      notes.map((note: Note) =>
        note.id === editingId
          ? { id: note.id, content }
          : { id: note.id, content: note.content },
      ),
      "Note updated",
    );
    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = (noteId: string) => {
    saveNotes(
      notes
        .filter((note: Note) => note.id !== noteId)
        .map(({ id, content }: Note) => ({ id, content })),
      "Note deleted",
    );
    setDeletingId(null);
  };

  const handleNewNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAddNote();
    }
  };

  const handleEditNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditingText("");
    }
  };

  function formatNoteDate(dateStr?: string): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Add note box */}
      <div className="border-b border-border bg-background/80 p-3.5">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              New Note
            </label>
            <span className="text-[10px] text-muted-foreground/50">Ctrl+Enter to save</span>
          </div>
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            onKeyDown={handleNewNoteKeyDown}
            placeholder="Capture thoughts, quotes, or questions while reading..."
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-input/60 bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || paperService.state.isUpdating}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              {paperService.state.isUpdating ? (
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
        {notes.length === 0 ? (
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
            {notes.map((note: Note) => {
              if (!note.id) return null;
              const isEditing = editingId === note.id;
              const isDeleting = deletingId === note.id;

              return (
                <li
                  key={note.id}
                  className="group relative rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all hover:border-border/80 hover:shadow-md"
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={handleEditNoteKeyDown}
                        className="w-full resize-none rounded-md border border-primary/50 bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors focus:ring-1 focus:ring-primary/20"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground/50">Esc to cancel</span>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => {
                              setEditingId(null);
                              setEditingText("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3 font-semibold"
                            onClick={handleSaveEdit}
                            disabled={!editingText.trim() || paperService.state.isUpdating}
                          >
                            {paperService.state.isUpdating ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 select-text">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                          {isDeleting ? (
                            <div className="flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 p-0.5 animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => handleDelete(note.id as string)}
                                title="Confirm delete"
                                className="flex size-5 items-center justify-center rounded text-destructive hover:bg-destructive/20 transition-colors"
                              >
                                <Check className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                title="Cancel"
                                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-colors"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => {
                                  setEditingId(note.id as string);
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
                                className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeletingId(note.id as string)}
                                title="Delete note"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70">
                        <Calendar className="size-3" />
                        <span>{formatNoteDate(note.updatedAt || note.createdAt)}</span>
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
