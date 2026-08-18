'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button, Textarea } from '@/shared/components/ui';
import { normalizeNotes, type NormalizedNote } from '@/features/workspaces/library/utils/library.util';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface NotesSectionProps {
  paper: Paper;
  onAddNote?: (content: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, content: string) => void;
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
}: NotesSectionProps) {
  const paperId = paper.id;
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Reset internal interactive state when switching papers to avoid state leakage
  useEffect(() => {
    setIsAdding(false);
    setNewNoteContent('');
    setEditingNoteId(null);
    setEditingContent('');
  }, [paperId]);

  const notes: NormalizedNote[] = useMemo(() => {
    return normalizeNotes(paper.notes);
  }, [paper.notes]);

  const handleSaveNewNote = () => {
    const trimmed = newNoteContent.trim();
    if (!trimmed || !onAddNote) return;

    onAddNote(trimmed);
    setNewNoteContent('');
    setIsAdding(false);
  };

  const handleStartEdit = (n: NormalizedNote) => {
    setEditingNoteId(n.id);
    setEditingContent(n.content);
  };

  const handleSaveEdit = (noteId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;

    if (onUpdateNote) {
      onUpdateNote(noteId, trimmed);
    }
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Notes ({notes.length})
        </span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-xs text-foreground hover:underline font-medium cursor-pointer"
          >
            <Plus className="size-3 text-foreground" />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Add New Note Box */}
      {isAdding && (
        <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg border border-border/40 text-xs">
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
      {notes.length === 0 && !isAdding ? (
        <div className="py-6 text-center text-muted-foreground text-xs bg-muted/10 rounded-lg border border-dashed border-border/40">
          No notes yet. Click &quot;Add Note&quot; to write thoughts or annotations.
        </div>
      ) : (
        <div className="space-y-2 min-w-0">
          {notes.map((n) => (
            <div
              key={n.id}
              className="group/note relative p-2.5 rounded-lg bg-card border border-border/40 hover:border-border transition-colors text-xs shadow-xs min-w-0"
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
                        className="p-1 hover:text-foreground rounded cursor-pointer"
                        title="Edit note"
                      >
                        <Edit2 className="size-3" />
                      </button>
                      {onDeleteNote && (
                        <button
                          onClick={() => onDeleteNote(n.id)}
                          className="p-1 hover:text-foreground rounded cursor-pointer"
                          title="Delete note"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
