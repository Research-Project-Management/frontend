import { useState, useEffect, useCallback, useMemo } from "react";
import StickyNote from "../note/StickyNote";
import { type Note, NOTE_COLOR_CYCLE } from "~/types/sticky";
import { useParams } from "react-router";
import { useSticky } from "~/hooks/useSticky";
import { Layers2, Loader2, StickyNote as StickyNoteIcon } from "lucide-react";
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

interface StickyLayoutProps {
  scope?: "workspace" | "project";
}

export default function StickyLayout({ scope = "workspace" }: StickyLayoutProps) {
  const { workspaceId, projectId: routeProjectId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === routeProjectId);
  const resolvedProjectId = currentProject?._id || routeProjectId || "";
  const isProjectScope = scope === "project";
  const [searchQuery, setSearchQuery] = useState("");
  const [savingStatus, setSavingStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const {
    stickies: notes,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    reorderMutation,
    reorderProjectMutation,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleReorder
  } = useSticky({ 
    projectId: isProjectScope ? resolvedProjectId : undefined, 
    labels: selectedLabels 
  });

  useEffect(() => {
    if (updateMutation.isPending) setSavingStatus("saving");
    else if (updateMutation.isSuccess) {
      setSavingStatus("saved");
      setLastSavedAt(new Date());
    } else if (updateMutation.isError) setSavingStatus("error");
  }, [updateMutation.isPending, updateMutation.isSuccess, updateMutation.isError]);

  // Reset drag order when the underlying notes change (e.g., deletion/addition)
  useEffect(() => {
    setDragOrder(null);
  }, [notes.map(n => n._id).join(",")]);


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
    handleCreate({
      content: "<p></p>",
      color: getNextColor(notes),
      title: "",
      position: { x: 0, y: 0 },
    });
  };

  const handleUpdateNote = useCallback(
    (id: string, updatedFields: Partial<Note>) => {
      handleUpdate(id, updatedFields);
    },
    [handleUpdate],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      handleDelete(id);
    },
    [handleDelete],
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
      setDragOrder(newOrderIds);
      handleReorder(newOrderIds);
    }
  }, [notes, handleReorder]);

  const displayNotes = useMemo(() => {
    if (!dragOrder) return notes;
    const map = new Map(notes.map((n) => [n._id, n]));
    return dragOrder
      .map((id) => map.get(id))
      .filter((n): n is Note => n !== undefined);
  }, [notes, dragOrder]);


  const filteredNotes = useMemo(
    () =>
      displayNotes.filter((note) => {
        const matchesSearch =
          !searchQuery ||
          note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesLabels =
          selectedLabels.length === 0 ||
          selectedLabels.every((labelId) => note.labels?.some((l) => l._id === labelId));

        return matchesSearch && matchesLabels;
      }),
    [displayNotes, searchQuery, selectedLabels],
  );

  const copy = {
    title: isProjectScope ? "Notes" : "Stickies",
    Icon: isProjectScope ? StickyNoteIcon : Layers2,
    loading: isProjectScope ? "Loading notes..." : "Loading stickies...",
    emptyFiltered: isProjectScope ? "No notes match your filters" : "No stickies match your filters",
    empty: isProjectScope ? "No notes yet" : "No stickies yet",
    cta: isProjectScope ? 'Click "New Note" to get started' : 'Click "New Sticky" to get started',
    addLabel: isProjectScope ? "New Note" : "New Sticky",
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border/60 px-5 h-13 flex items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{copy.title}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{copy.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title={copy.title}
        Icon={copy.Icon}
        actions={
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            savingStatus={savingStatus}
            lastSavedAt={lastSavedAt}
            onAddNote={handleAddNote}
            isAddingNote={createMutation.isPending}
            selectedLabels={selectedLabels}
            addLabel={copy.addLabel}
            onToggleLabel={(labelId) =>
              setSelectedLabels((prev) =>
                prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
              )
            }
          />
        }
      />

      <main className="flex-1 overflow-auto p-5">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <copy.Icon className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery
                ? copy.emptyFiltered
                : copy.empty}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                {copy.cta}
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
