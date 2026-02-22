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

export default function StickyLayout() {
  const { workspaceId } = useParams();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [orderedNotes, setOrderedNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useStickies(
    workspaceId || "",
    selectedTags,
  );
  const { data: tags = [] } = useTags(workspaceId || "");
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
            <Layers2 className="h-4 w-4 text-muted-foreground" />
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
      {/* ── Combined header + toolbar ── */}
      <header className="shrink-0 border-b border-border/60 bg-background">
        <div className="flex items-center gap-3 px-5 h-13">
          {/* Left: title + count */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <Layers2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm">Stickies</span>
            {filteredNotes.length > 0 && (
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {filteredNotes.length}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-border/60 shrink-0" />

          {/* Center: search */}
          <div className="relative flex-1 max-w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search stickies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-secondary/40 border-border/40 focus-visible:ring-primary/30"
            />
          </div>

          {/* Tags filter */}
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

          {/* Right: save status + new button */}
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
              disabled={createSticky.isPending}
            >
              {createSticky.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              New Sticky
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
                  ? "No stickies match your filters"
                  : "No stickies yet"}
              </p>
              {!searchQuery && selectedTags.length === 0 && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Click "New Sticky" to get started
                </p>
              )}
            </div>
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
    // When dragging: hide the original slot (DragOverlay renders the visible ghost)
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
