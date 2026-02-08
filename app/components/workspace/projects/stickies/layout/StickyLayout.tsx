import { useState, useEffect, useCallback } from "react";
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
import Header from "~/components/workspace/projects/layout/Header";
import { Layers2, Plus, Search, X, Filter } from "lucide-react";
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

export default function StickyLayout() {
  const { workspaceId } = useParams();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orderedNotes, setOrderedNotes] = useState<Note[]>([]);

  // Queries & Mutations
  const { data: notes = [], isLoading } = useStickies(
    workspaceId || "",
    selectedTags,
  );
  const { data: tags = [] } = useTags(workspaceId || "");
  const createSticky = useCreateSticky();
  const updateSticky = useUpdateSticky();
  const deleteSticky = useDeleteSticky();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Search logic handled in filteredNotes
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle mutation states in useEffect to avoid too many re-renders
  useEffect(() => {
    if (updateSticky.isPending) {
      setSavingStatus("saving");
    } else if (updateSticky.isSuccess) {
      setSavingStatus("saved");
      setLastSavedAt(new Date());
    } else if (updateSticky.isError) {
      setSavingStatus("error");
    }
  }, [updateSticky.isPending, updateSticky.isSuccess, updateSticky.isError]);

  // helpers
  const isEmptyContent = (content: string) => {
    const text = content
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    return text.length === 0;
  };

  const getNextColor = (prevNotes: Note[]): Note["color"] => {
    if (prevNotes.length === 0) return NOTE_COLOR_CYCLE[0];

    const lastColor = prevNotes[0].color;
    const idx = NOTE_COLOR_CYCLE.indexOf(lastColor);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % NOTE_COLOR_CYCLE.length;
    return NOTE_COLOR_CYCLE[nextIdx];
  };

  // crud
  const handleAddNote = () => {
    if (!workspaceId) return;

    const color = getNextColor(notes);

    createSticky.mutate({
      workspaceId,
      content: "<p></p>", // Send empty paragraph to ensure backend validation passes
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

  // Update ordered notes when notes change
  useEffect(() => {
    setOrderedNotes(notes);
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

    const currentNotes = orderedNotes.length > 0 ? orderedNotes : notes;
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

  const displayNotes = orderedNotes.length > 0 ? orderedNotes : notes;

  const filteredNotes = displayNotes.filter((note) => {
    const matchesSearch =
      !searchQuery ||
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const handleTagToggle = (tagId: string, checked: boolean) => {
    if (checked) {
      setSelectedTags([...selectedTags, tagId]);
    } else {
      setSelectedTags(selectedTags.filter((id) => id !== tagId));
    }
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading stickies...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Header title="Stickies" Icon={Layers2} />

      {/* Toolbar */}
      <div className="shrink-0 bg-background">
        <div className="flex items-center justify-between px-6 py-3 gap-4">
          {/* Left side - Search & Filter */}
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search stickies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Filter by Tags */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  Tags
                  {selectedTags.length > 0 && (
                    <span className="ml-2 flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs">
                      {selectedTags.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px]">
                <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tags.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No tags yet
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    {tags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag._id}
                        checked={selectedTags.includes(tag._id)}
                        onCheckedChange={(checked) =>
                          handleTagToggle(tag._id, checked)
                        }
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span>{tag.name}</span>
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
                        className="w-full justify-center"
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
                    className="w-full justify-start"
                    onClick={() => setManageTagsOpen(true)}
                  >
                    Manage tags
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side - Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Saving Status */}
            {savingStatus === "saving" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Saving...</span>
              </div>
            )}
            {savingStatus === "saved" && lastSavedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Saved</span>
              </div>
            )}
            {savingStatus === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span>Error</span>
              </div>
            )}

            {/* Add Sticky Button */}
            <Button onClick={handleAddNote} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Sticky
            </Button>
          </div>
        </div>
      </div>

      <ManageTagsModal
        open={manageTagsOpen}
        onClose={() => setManageTagsOpen(false)}
      />

      <main className="flex-1 overflow-auto px-5 py-4">
        <div className="w-full">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note._id}
                className={`transition-all duration-200 ${
                  draggedId === note._id ? "opacity-50 scale-95" : "opacity-100"
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
        </div>
      </main>
    </div>
  );
}
