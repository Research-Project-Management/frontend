'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { normalizeNotes, type NormalizedNote } from '@/features/workspaces/library/utils/library.util';
import { useNotes } from '@/features/workspaces/library/hooks/library/use-notes';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface NotesSectionProps {
  paper: Paper;
  onAddNote?: (content: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, content: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
}

function formatNoteDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotesSection({
  paper,
  onAddNote,
  onDeleteNote,
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
      return canonicalNotes.map((n: any) => ({
        id: n.id,
        content: n.contentMd || n.content || '',
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      }));
    }
    return normalizeNotes(paper.notes);
  }, [canonicalNotes, paper.notes]);

  const handleSaveNewNote = async () => {
    const trimmed = newNoteContent.trim();
    if (!trimmed) return;

    if (paper.workspaceId) {
      try {
        await createNote({ itemId: paper.id, contentMd: trimmed });
      } catch {
        if (onAddNote) onAddNote(trimmed);
      }
    } else if (onAddNote) {
      onAddNote(trimmed);
    }
    setNewNoteContent('');
    setIsAdding(false);
  };

  const handleStartEdit = (n: NormalizedNote) => {
    setEditingNoteId(n.id);
    setEditingContent(n.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;

    const target = canonicalNotes.find((n) => n.id === noteId);
    if (target && paper.workspaceId) {
      try {
        await updateNote(noteId, target.version || 1, { contentMd: trimmed });
      } catch {
        if (onUpdateNote) onUpdateNote(noteId, trimmed);
      }
    } else if (onUpdateNote) {
      onUpdateNote(noteId, trimmed);
    }
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleDelete = async (noteId: string) => {
    const target = canonicalNotes.find((n) => n.id === noteId);
    if (target && paper.workspaceId) {
      try {
        await deleteNote(noteId, target.version);
      } catch {
        if (onDeleteNote) onDeleteNote(noteId);
      }
    } else if (onDeleteNote) {
      onDeleteNote(noteId);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  return (
    <div className="space-y-3 min-w-0">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Notes
          </h3>
          {!isAdding && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAdding(true)}
              className="h-6 px-1.5 text-xs text-foreground hover:bg-muted font-medium gap-1 cursor-pointer"
            >
              <Plus className="size-3 text-foreground" />
              <span>Add Note</span>
            </Button>
          )}
        </div>
      )}

      {/* Add New Note Box */}
      {isAdding && (
        <div className="space-y-2 p-2.5 bg-muted/20 rounded-md border border-border/40 text-xs">
          <Textarea
            autoFocus
            placeholder="Write research notes, thoughts, or key findings... (Ctrl+Enter to save)"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSaveNewNote();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewNoteContent('');
              }
            }}
            rows={3}
            className="text-xs resize-none w-full max-h-48 overflow-y-auto"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground/60">Press ⌘/Ctrl+Enter to save</span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewNoteContent('');
                }}
                className="h-7 px-2 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNewNote}
                disabled={!newNoteContent.trim()}
                className="h-7 px-2.5 text-xs cursor-pointer"
              >
                Save Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 && !isAdding ? null : (
        <div className="space-y-2 min-w-0">
          {notes.map((n) => (
            <div
              key={n.id}
              className="group/note relative p-3 rounded-md bg-muted/20 hover:bg-muted/30 border border-border/40 transition-colors text-xs min-w-0"
            >
              {editingNoteId === n.id ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEdit(n.id);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    rows={3}
                    className="text-xs resize-none w-full max-h-48 overflow-y-auto"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-6 px-2 text-xs cursor-pointer"
                    >
                      <X className="size-3 mr-1" /> Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(n.id)}
                      disabled={!editingContent.trim()}
                      className="h-6 px-2 text-xs cursor-pointer"
                    >
                      <Check className="size-3 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] pr-8">
                    {n.content}
                  </p>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/20 text-xs font-mono text-muted-foreground">
                    <span>{formatNoteDate(n.createdAt || n.updatedAt)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(n)}
                        className="p-1 text-foreground hover:bg-muted rounded cursor-pointer transition-colors"
                        title="Edit note"
                        aria-label="Edit note"
                      >
                        <Edit2 className="size-3 text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="p-1 text-foreground hover:bg-muted rounded cursor-pointer transition-colors"
                        title="Delete note"
                        aria-label="Delete note"
                      >
                        <Trash2 className="size-3 text-foreground" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          {!isAdding && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAdding(true)}
              className="w-full h-7 text-xs gap-1.5 cursor-pointer font-medium border-dashed border-border/60 hover:border-border mt-1"
            >
              <Plus className="size-3.5 text-foreground" />
              <span>Add Note</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
