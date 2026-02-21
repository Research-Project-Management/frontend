import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router";
import { Plus, StickyNote as StickyIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";
import {
  useStickies,
  useCreateSticky,
  useUpdateSticky,
  useDeleteSticky,
} from "~/query/sticky";
import StickyNote from "../../stickies/note/StickyNote";
import type { Note } from "../../stickies/types/note.type";
import { NOTE_COLOR_CYCLE } from "../../stickies/types/noteColor.type";

export default function Stickies() {
  const { workspaceId } = useParams();
  const { data: notes = [], isLoading } = useStickies(workspaceId || "", []);
  const createSticky = useCreateSticky();
  const updateSticky = useUpdateSticky();
  const deleteSticky = useDeleteSticky();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orderedNotes, setOrderedNotes] = useState<Note[]>([]);

  const getNextColor = (prevNotes: Note[]): Note["color"] => {
    if (prevNotes.length === 0) return NOTE_COLOR_CYCLE[0];

    const lastColor = prevNotes[0].color;
    const idx = NOTE_COLOR_CYCLE.indexOf(lastColor);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % NOTE_COLOR_CYCLE.length;
    return NOTE_COLOR_CYCLE[nextIdx];
  };

  const handleAddNote = () => {
    if (!workspaceId) return;

    const color = getNextColor(notes);

    createSticky.mutate({
      workspaceId,
      content: "<p></p>",
      color,
      title: "",
      position: { x: 0, y: 0 },
    });
  };

  const handleUpdateNote = useCallback(
    (id: string, updatedFields: Partial<Note>) => {
      updateSticky.mutate({
        stickyId: id,
        updates: updatedFields,
      });
    },
    [updateSticky],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteSticky.mutate(id);
    },
    [deleteSticky],
  );

  // Update ordered notes when data changes
  useEffect(() => {
    if (notes.length > 0) {
      setOrderedNotes(notes.slice(0, 4));
    }
  }, [notes]);

  const handleDragStart = (noteId: string) => {
    setDraggedId(noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const currentNotes =
      orderedNotes.length > 0 ? orderedNotes : notes.slice(0, 4);
    const draggedIndex = currentNotes.findIndex((n) => n._id === draggedId);
    const targetIndex = currentNotes.findIndex((n) => n._id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newOrder = [...currentNotes];
    const [draggedNote] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedNote);

    setOrderedNotes(newOrder);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const displayNotes =
    orderedNotes.length > 0 ? orderedNotes : notes.slice(0, 4);

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <StickyIcon className="w-5 h-5" />
            Quick Notes
          </h2>
        </div>
        <p className="text-muted-foreground">Loading stickies...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <StickyIcon className="w-4 h-4" />
          Quick Notes
        </h2>
        <div className="flex items-center gap-2">
          <Button onClick={handleAddNote} size="sm" variant="outline">
            <Plus className="w-3 h-3 mr-1" />
            New
          </Button>
          {notes.length > 0 && (
            <Link to={`/${workspaceId}/stickies`}>
              <Button size="sm" variant="ghost" className="text-xs">
                View All
              </Button>
            </Link>
          )}
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3 border-2 border-dashed rounded-lg">
          <StickyIcon className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No stickies yet</p>
          <Button onClick={handleAddNote} variant="outline" size="sm">
            <Plus className="w-3 h-3 mr-1" />
            Create your first sticky
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayNotes.map((note) => (
            <div
              key={note._id}
              className={`h-48 overflow-hidden transition-all duration-200 ${
                draggedId === note._id ? "opacity-80 scale-95" : "opacity-100"
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, note._id)}
            >
              <StickyNote
                note={note}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: () => handleDragStart(note._id),
                  onDragEnd: handleDragEnd,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
