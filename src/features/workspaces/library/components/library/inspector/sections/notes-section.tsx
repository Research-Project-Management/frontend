'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, FileText } from 'lucide-react';
import { Button, Textarea } from '@/shared/components/ui';
import type { Paper, Note } from '@/features/workspaces/library/types/library.types';

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
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const notes = paper.notes || [];

  const handleSaveNewNote = () => {
    if (newNoteContent.trim() && onAddNote) {
      onAddNote(newNoteContent.trim());
      setNewNoteContent('');
      setIsAdding(false);
    }
  };

  const handleStartEdit = (n: Note) => {
    setEditingNoteId(n._id);
    setEditingContent(n.content);
  };

  const handleSaveEdit = (noteId: string) => {
    if (editingContent.trim() && onUpdateNote) {
      onUpdateNote(noteId, editingContent.trim());
    }
    setEditingNoteId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Notes ({notes.length})
        </span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
          >
            <Plus className="size-3" />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Add New Note Box */}
      {isAdding && (
        <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg border border-border/40 text-xs">
          <Textarea
            autoFocus
            placeholder="Write research notes, thoughts, or key findings..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={3}
            className="text-xs resize-none"
          />
          <div className="flex justify-end gap-1.5 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewNoteContent('');
              }}
              className="h-7 px-2 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNewNote}
              disabled={!newNoteContent.trim()}
              className="h-7 px-2.5 text-xs"
            >
              Save Note
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 && !isAdding ? (
        <div className="py-6 text-center text-muted-foreground text-xs bg-muted/10 rounded-lg border border-dashed border-border/40">
          No notes yet. Click &quot;Add Note&quot; to write thoughts or annotations.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div
              key={n._id}
              className="group/note relative p-2.5 rounded-lg bg-card border border-border/40 hover:border-border transition-colors text-xs"
            >
              {editingNoteId === n._id ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={3}
                    className="text-xs resize-none"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingNoteId(null)}
                      className="h-6 px-2 text-xs"
                    >
                      <X className="size-3 mr-1" /> Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(n._id)}
                      className="h-6 px-2 text-xs"
                    >
                      <Check className="size-3 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed pr-8">
                    {n.content}
                  </p>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/20 text-[10px] text-muted-foreground">
                    <span>{formatNoteDate(n.createdAt || n.updatedAt)}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(n)}
                        className="p-1 hover:text-foreground rounded"
                        title="Edit note"
                      >
                        <Edit2 className="size-3" />
                      </button>
                      {onDeleteNote && (
                        <button
                          onClick={() => onDeleteNote(n._id)}
                          className="p-1 hover:text-destructive rounded"
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
