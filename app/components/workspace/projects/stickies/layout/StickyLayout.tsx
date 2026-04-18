import { useState, useEffect, useCallback, useMemo } from "react";
import StickyNote from "../note/StickyNote";
import type { Note } from "../types/note.type";
import { NOTE_COLOR_CYCLE } from "../types/noteColor.type";
import { useParams } from "react-router";
import {
  useStickies,
  useCreateSticky,
  useUpdateSticky,
  useDeleteSticky,
} from "~/query/sticky";
import { Layers2, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useProjects } from "~/hooks/useWorkspace";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Topbar from "~/components/workspace/projects/$projectId/overview/Topbar";
import TopBar from "./TopBar";

export default function StickyLayout() {
  const { workspaceId, projectId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === projectId);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingStatus, setSavingStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [orderedNotes, setOrderedNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: notes = [], isLoading } = useStickies(workspaceId || "");
  const createSticky = useCreateSticky();
  const updateSticky = useUpdateSticky();
  const deleteSticky = useDeleteSticky();

  useEffect(() => {
    if (updateSticky.isPending) setSavingStatus("saving");
    else if (updateSticky.isSuccess) {
      setSavingStatus("saved");
      setLastSavedAt(new Date());
    } else if (updateSticky.isError) setSavingStatus("error");
  }, [updateSticky.isPending, updateSticky.isSuccess, updateSticky.isError]);

  useEffect(() => {
    setOrderedNotes(notes);
  }, [notes]);

  const getNextColor = (prevNotes: Note[]): Note["color"] => {
    if (prevNotes.length === 0) return NOTE_COLOR_CYCLE[0];
    const lastColor = prevNotes[0].color;
    const idx = NOTE_COLOR_CYCLE.indexOf(lastColor);
    return NOTE_COLOR_CYCLE[
      idx === -1 ? 0 : (idx + 1) % NOTE_COLOR_CYCLE.length
    ];
  };

  const handleAddNote = () => {
    if (!workspaceId) return;
    createSticky.mutate({
      workspaceId,
      content: "<p></p>",
      color: getNextColor(notes),
      title: "",
      position: { x: 0, y: 0 },
    });
  };

  const handleUpdateNote = useCallback(
    (id: string, updatedFields: Partial<Note>) => {
      updateSticky.mutate({ stickyId: id, updates: updatedFields });
    },
    [updateSticky],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteSticky.mutate(id);
    },
    [deleteSticky],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedNotes((prev) => {
      const oldIdx = prev.findIndex((n) => n._id === active.id);
      const newIdx = prev.findIndex((n) => n._id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const displayNotes = orderedNotes.length > 0 ? orderedNotes : notes;

  const filteredNotes = useMemo(
    () =>
      displayNotes.filter((note) => {
        const matchesSearch =
          !searchQuery ||
          note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTags =
          selectedTags.length === 0 ||
          (note.tags && note.tags.some((tag) => selectedTags.includes(tag._id)));

        return matchesSearch && matchesTags;
      }),
    [displayNotes, searchQuery, selectedTags],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border/60 px-5 h-13 flex items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Stickies</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading stickies…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Stickies"
        Icon={Layers2}
        actions={
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            savingStatus={savingStatus}
            lastSavedAt={lastSavedAt}
            onAddNote={handleAddNote}
            isAddingNote={createSticky.isPending}
            selectedTags={selectedTags}
            onToggleTag={(tagId) =>
              setSelectedTags((prev) =>
                prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
              )
            }
          />
        }
      />

      <main className="flex-1 overflow-auto p-5">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <Layers2 className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery
                ? "No stickies match your filters"
                : "No stickies yet"}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Click "New Sticky" to get started
              </p>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredNotes.map((n) => n._id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 items-start">
                {filteredNotes.map((note) => (
                  <SortableNote
                    key={note._id}
                    note={note}
                    onUpdate={handleUpdateNote}
                    onDelete={handleDeleteNote}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeId
                ? (() => {
                    const note = filteredNotes.find((n) => n._id === activeId);
                    return note ? (
                      <div className="rotate-1 scale-105 shadow-2xl cursor-grabbing">
                        <StickyNote
                          note={note}
                          onUpdate={handleUpdateNote}
                          onDelete={handleDeleteNote}
                        />
                      </div>
                    ) : null;
                  })()
                : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  );
}

function SortableNote({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: note._id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? ("none" as const) : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StickyNote
        note={note}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
