import React, { useState, useCallback, useEffect } from "react";
import { Loader2, Plus, Edit3, Trash2, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui";
import { usePapers } from "@/features/workspaces/library/hooks/data/use-papers";
import type { Paper, Note } from "@/features/workspaces/library/types/library.types";

export default function NotesPanel({
  paper,
  workspaceId,
}: {
  paper: Paper;
  workspaceId: string;
}) {
  const paperService = usePapers({ workspaceId, collectionId: paper.collectionId || "" });
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    setNewNote("");
    setEditingId(null);
    setEditingText("");
  }, [paper._id]);

  const notes = paper.notes ?? [];

  const saveNotes = useCallback(
    (
      nextNotes: Array<{
        _id?: string;
        content: string;
        createdAt?: string;
        updatedAt?: string;
      }>,
      successMessage: string,
    ) => {
      paperService.actions.updatePaper(
        { paperId: paper._id, notes: nextNotes as any },
        { onSuccess: () => toast.success(successMessage) },
      );
    },
    [paper._id, paperService.actions.updatePaper],
  );

  const handleAddNote = () => {
    const content = newNote.trim();
    if (!content) return;
    saveNotes(
      [...notes.map(({ _id, content }: Note) => ({ _id, content })), { content }],
      "Note added",
    );
    setNewNote("");
  };

  const handleSaveEdit = () => {
    const content = editingText.trim();
    if (!editingId || !content) return;
    saveNotes(
      notes.map((note: Note) =>
        note._id === editingId
          ? { _id: note._id, content }
          : { _id: note._id, content: note.content },
      ),
      "Note updated",
    );
    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    saveNotes(
      notes
        .filter((note: Note) => note._id !== noteId)
        .map(({ _id, content }: Note) => ({ _id, content })),
      "Note deleted",
    );
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
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background/80 p-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            New note
          </label>
          <textarea
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            placeholder="Capture a thought while reading..."
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || paperService.state.isUpdating}
            >
              {paperService.state.isUpdating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add note
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">
              <FileText className="size-5 text-muted-foreground/50" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No notes yet</p>
            <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-muted-foreground">
              Jot down key takeaways or questions as you read.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {notes.map((note: Note) => {
              if (!note._id) return null;
              const isEditing = editingId === note._id;
              return (
                <li key={note._id} className="group relative rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors focus:border-primary"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditingText("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
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
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              setEditingId(note._id as string);
                              setEditingText(note.content);
                            }}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(note._id as string)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
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
