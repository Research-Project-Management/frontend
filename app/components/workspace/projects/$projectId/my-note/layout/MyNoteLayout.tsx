import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import MyNote from "../note/MyNote";
import type { Note } from "../types/note.type";
import { NOTE_COLOR_CYCLE } from "../types/noteColor.type";
import { useParams } from "react-router";
import {
  useMyNotes,
  useCreateMyNote,
  useUpdateMyNote,
  useDeleteMyNote,
} from "~/query/my-note";
import { useTags } from "~/query/tag";
import {
  Layers2,
  Plus,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import ManageTagsModal from "../modals/ManageTagsModal";
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
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function MyNoteLayout() {
  const { workspaceId, projectId } = useParams();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useMyNotes(
    projectId || "",
    selectedTags
  );
  const { data: tags = [] } = useTags(workspaceId || "");
  const createNote = useCreateMyNote();
  const updateNote = useUpdateMyNote();
  const deleteNote = useDeleteMyNote();

  useEffect(() => {
    if (updateNote.isPending) setSavingStatus("saving");
    else if (updateNote.isSuccess) {
      setSavingStatus("saved");
      setLastSavedAt(new Date());
    } else if (updateNote.isError) setSavingStatus("error");
  }, [updateNote.isPending, updateNote.isSuccess, updateNote.isError]);

  const noteIdsKey = notes.map((n) => n._id).join(",");
  useEffect(() => {
    setDragOrder(null);
  }, [noteIdsKey]);

  const getNextColor = (prevNotes: Note[]): Note["color"] => {
    if (prevNotes.length === 0) return NOTE_COLOR_CYCLE[0];
    const lastColor = prevNotes[0].color;
    const idx = NOTE_COLOR_CYCLE.indexOf(lastColor);
    return NOTE_COLOR_CYCLE[
      idx === -1 ? 0 : (idx + 1) % NOTE_COLOR_CYCLE.length
    ];
  };

  const handleAddNote = () => {
    if (!projectId) return;
    createNote.mutate({
      projectId,
      content: "<p></p>",
      color: getNextColor(notes),
      title: "",
    });
  };

  const updateNoteRef = useRef(updateNote);
  updateNoteRef.current = updateNote;
  const deleteNoteRef = useRef(deleteNote);
  deleteNoteRef.current = deleteNote;

  const handleUpdateNote = useCallback(
    (id: string, updatedFields: Partial<Note>) => {
      updateNoteRef.current.mutate({ noteId: id, updates: updatedFields });
    },
    [],
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNoteRef.current.mutate(id);
    },
    [],
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
    setDragOrder((prev) => {
      const ids = prev ?? notes.map((n) => n._id);
      const oldIdx = ids.indexOf(String(active.id));
      const newIdx = ids.indexOf(String(over.id));
      return arrayMove(ids, oldIdx, newIdx);
    });
  }, [notes]);

  const displayNotes = useMemo(() => {
    if (!dragOrder) return notes;
    const map = new Map(notes.map((n) => [n._id, n]));
    return dragOrder
      .map((id) => map.get(id))
      .filter((n): n is Note => n !== undefined);
  }, [notes, dragOrder]);

  const filteredNotes = useMemo(
    () =>
      displayNotes.filter(
        (note) =>
          !searchQuery ||
          note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [displayNotes, searchQuery],
  );

  const handleTagToggle = (tagId: string, checked: boolean) => {
    setSelectedTags((prev) =>
      checked ? [...prev, tagId] : prev.filter((id) => id !== tagId),
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border/60 px-5 h-13 flex items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">My Notes</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading notes…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <header className="shrink-0 border-b border-border/60 bg-background">
        <div className="flex items-center gap-3 px-5 h-13">
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-sm">My Notes</span>
            {filteredNotes.length > 0 && (
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {filteredNotes.length}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border/60 shrink-0" />

          <div className="relative flex-1 max-w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-secondary/40 border-border/40 focus-visible:ring-primary/30"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 border-border/40 text-xs gap-1.5 shrink-0 ${
                  selectedTags.length > 0
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : ""
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Tags
                {selectedTags.length > 0 && (
                  <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {selectedTags.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-50">
              <DropdownMenuLabel className="text-xs">
                Filter by Tag
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tags.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No tags yet
                </div>
              ) : (
                <div className="max-h-65 overflow-y-auto">
                  {tags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag._id}
                      checked={selectedTags.includes(tag._id)}
                      onCheckedChange={(c) => handleTagToggle(tag._id, c)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs">{tag.name}</span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              )}
              {selectedTags.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-xs h-7"
                      onClick={() => setSelectedTags([])}
                    >
                      Clear all
                    </Button>
                  </div>
                </>
              )}
              <DropdownMenuSeparator />
              <div className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => setManageTagsOpen(true)}
                >
                  Manage tags
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {savingStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving
              </span>
            )}
            {savingStatus === "saved" && lastSavedAt && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </span>
            )}
            {savingStatus === "error" && (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                Error
              </span>
            )}

            <Button
              onClick={handleAddNote}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={createNote.isPending}
            >
              {createNote.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              New Note
            </Button>
          </div>
        </div>
      </header>

      <ManageTagsModal
        open={manageTagsOpen}
        onClose={() => setManageTagsOpen(false)}
      />

      <main className="flex-1 overflow-auto p-5">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <Layers2 className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery || selectedTags.length > 0
                  ? "No project notes match your filters"
                  : "No project notes yet"}
              </p>
              {!searchQuery && selectedTags.length === 0 && (
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-48 mx-auto">
                  Capture project-specific ideas and tasks here.
                </p>
              )}
            </div>
            <Button onClick={handleAddNote} variant="outline" size="sm" className="mt-2 h-8 border-dashed border-muted-foreground/30 hover:border-primary/50 text-xs">
              <Plus className="h-3 w-3 mr-1.5" />
              Create your first note
            </Button>
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 items-start pb-20">
                {filteredNotes.map((note, index) => (
                  <div
                    key={note._id}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <SortableNote
                      note={note}
                      onUpdate={handleUpdateNote}
                      onDelete={handleDeleteNote}
                    />
                  </div>
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

  const dragHandleProps = useMemo(
    () => ({
      ...attributes,
      ...listeners,
    }),
    [attributes, listeners],
  );

  return (
    <div ref={setNodeRef} style={style}>
      <MyNote
        note={note}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
      />
    </div>
  );
});
