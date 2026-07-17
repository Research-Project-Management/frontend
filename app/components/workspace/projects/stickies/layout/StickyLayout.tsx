import React, { useState, useEffect, useCallback, useMemo } from "react";
import StickyNote from "../note/StickyNote";
import { type Note, NOTE_COLOR_CYCLE } from "~/types/sticky";
import { useParams } from "react-router";
import { useSticky } from "~/hooks/useSticky";
import { useLabelsQuery } from "~/query/label";
import { Badge } from "~/components/ui/badge";
import { Layers2, Loader2, StickyNote as StickyNoteIcon, X } from "lucide-react";
import { useProjects, useWorkspace, useDocumentTitle } from "~/hooks";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";
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
  const { workspace } = useWorkspace();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === routeProjectId);
  const resolvedProjectId = currentProject?._id || routeProjectId || "";
  const isProjectScope = scope === "project";
  const [searchQuery, setSearchQuery] = useState("");

  const tabTitle = isProjectScope
    ? `Notes${currentProject?.name ? ` - ${currentProject.name}` : ""}`
    : `Stickies${workspace?.name ? ` - ${workspace.name}` : ""}`;

  useDocumentTitle(tabTitle);
  const [savingStatus, setSavingStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const { data: allLabels = [] } = useLabelsQuery(workspaceId || "", "sticky");

  // Remove selected labels that no longer exist
  useEffect(() => {
    if (allLabels.length > 0 && selectedLabels.length > 0) {
      const validLabels = selectedLabels.filter(id => allLabels.some(l => l._id === id));
      if (validLabels.length !== selectedLabels.length) {
        setSelectedLabels(validLabels);
      }
    }
  }, [allLabels, selectedLabels]);

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
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
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
      // Pass projectId explicitly so useSticky routes to the right reorder endpoint
      if (isProjectScope && resolvedProjectId) {
        reorderProjectMutation.mutateAsync({ projectId: resolvedProjectId, stickyIds: newOrderIds });
      } else {
        handleReorder(newOrderIds);
      }
    }
  }, [notes, handleReorder, reorderProjectMutation, isProjectScope, resolvedProjectId]);

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) => {
        const matchesSearch =
          !searchQuery ||
          note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesLabels =
          selectedLabels.length === 0 ||
          selectedLabels.some((labelId) => note.labels?.some((l) => l._id === labelId));

        return matchesSearch && matchesLabels;
      }),
    [notes, searchQuery, selectedLabels],
  );

  const copy = {
    title: isProjectScope ? "Notes" : "Stickies",
    Icon: isProjectScope ? StickyNoteIcon : Layers2,
    loading: isProjectScope ? "Loading notes..." : "Loading stickies...",
    emptyFiltered: isProjectScope ? "No notes match your filters" : "No stickies match your filters",
    empty: isProjectScope ? "No notes yet" : "No stickies yet",
    cta: isProjectScope ? 'Click "Add Note" to get started' : 'Click "Add Sticky" to get started',
    addLabel: isProjectScope ? "Add Note" : "Add Sticky",
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
            labelType="sticky"
            projectId={isProjectScope ? resolvedProjectId : undefined}
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
            collisionDetection={closestCorners}
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

            {createPortal(
              <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: {
                    active: {
                      opacity: '0.5',
                    },
                  },
                }),
              }}>
                {activeId
                  ? (() => {
                      const note = filteredNotes.find((n) => n._id === activeId);
                      return note ? (
                        <div className="rotate-1 scale-105 shadow-2xl cursor-grabbing">
                          <StickyNote
                            note={note}
                            onUpdate={handleUpdateNote}
                            onDelete={handleDeleteNote}
                            isDragging={true}
                          />
                        </div>
                      ) : null;
                    })()
                  : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        )}
      </main>
    </div>
  );
}
const SortableNote = React.memo(({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: note._id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.2, 0, 0, 1.0)",
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : 0,
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
});

SortableNote.displayName = "SortableNote";
