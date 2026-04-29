import { useState, useCallback, useMemo, memo } from "react";
import MyNote from "../note/MyNote";
import type { Note } from "../types/note.type";
import { NOTE_COLOR_CYCLE } from "../types/noteColor.type";
import { useParams } from "react-router";
import {
  useMyNotes,
  useCreateMyNote,
  useUpdateMyNote,
  useDeleteMyNote,
  useReorderMyNotes,
} from "~/query/my-note";
import {
  StickyNote,
  Loader2,
} from "lucide-react";
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
import { useProjects } from "~/hooks/useWorkspace";
import Topbar from "~/components/workspace/projects/$projectId/overview/Topbar";
import TopBar from "./TopBar";

export default function MyNoteLayout() {
  const { workspaceId, projectId: routeProjectId } = useParams();
  const { projects } = useProjects();
  
  const currentProject = useMemo(() => {
    return projects.find((p: any) => p._id === routeProjectId);
  }, [projects, routeProjectId]);

  const resolvedProjectId = useMemo(() => {
    if (!currentProject) return routeProjectId || "";
    return currentProject._id;
  }, [currentProject, routeProjectId]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useMyNotes(
    resolvedProjectId,
    workspaceId || "",
    selectedTags
  );

  const createNote = useCreateMyNote();
  const updateNote = useUpdateMyNote();
  const deleteNote = useDeleteMyNote();
  const reorderNotes = useReorderMyNotes();

  const getNextColor = (prevNotes: Note[]): Note["color"] => {
    if (prevNotes.length === 0) return NOTE_COLOR_CYCLE[0];
    return NOTE_COLOR_CYCLE[prevNotes.length % NOTE_COLOR_CYCLE.length];
  };

  const handleAddNote = () => {
    if (!workspaceId || !resolvedProjectId) return;
    createNote.mutate({
      workspaceId,
      projectId: resolvedProjectId,
      content: "<p></p>",
      color: getNextColor(notes),
      title: "",
    });
  };

  const handleUpdateNote = useCallback(
    (id: string, updatedFields: Partial<Note>) => {
      updateNote.mutate({ 
        projectId: resolvedProjectId, 
        workspaceId: workspaceId || "", 
        noteId: id, 
        updates: updatedFields 
      });
    },
    [resolvedProjectId, updateNote],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNote.mutate({ 
        projectId: resolvedProjectId, 
        workspaceId: workspaceId || "", 
        noteId: id 
      });
    },
    [resolvedProjectId, deleteNote],
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

    const oldIdx = notes.findIndex((n) => n._id === String(active.id));
    const newIdx = notes.findIndex((n) => n._id === String(over.id));
    
    if (oldIdx !== -1 && newIdx !== -1) {
      const newOrderIds = arrayMove(notes.map(n => n._id), oldIdx, newIdx);
      reorderNotes.mutate({ projectId: resolvedProjectId, noteIds: newOrderIds });
    }
  }, [notes, reorderNotes, resolvedProjectId]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Basic search filter
      const matchesSearch = !searchQuery || 
        note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [notes, searchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Notes"
        Icon={StickyNote}
        actions={
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddNote={handleAddNote}
            isAddingNote={createNote.isPending}
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
        {isLoading && notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground animate-in fade-in duration-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading notes…</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <StickyNote className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery || selectedTags.length > 0
                ? "No notes match your filters"
                : "No notes yet"}
            </p>
            {!searchQuery && selectedTags.length === 0 && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Click "New Note" to get started
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 items-start pb-20">
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
                        <MyNote
                          note={note}
                          onUpdate={handleUpdateNote}
                          onDelete={handleDeleteNote}
                          isOverlay
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

const SortableNote = memo(function SortableNote({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
      <MyNote
        note={note}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
});
