import { useState, useMemo, useRef } from "react";
import { Search, Check, ChevronLeft, SquarePen, Tag, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { useTags, useUpdateTag, useDeleteTag, useCreateTag } from "~/query/sticky";
import { useParams } from "react-router";
import type { Tag as TagType } from "../types/note.type";

const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" }, { name: "yellow_subtle", color: "#f8e6a0" }, { name: "orange_subtle", color: "#fedec8" }, { name: "red_subtle", color: "#ffd5d2" }, { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" }, { name: "yellow", color: "#f5cd47" }, { name: "orange", color: "#fea362" }, { name: "red", color: "#f87168" }, { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" }, { name: "yellow_bold", color: "#946f00" }, { name: "orange_bold", color: "#c25100" }, { name: "red_bold", color: "#c9372c" }, { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" }, { name: "sky_subtle", color: "#c6edfb" }, { name: "lime_subtle", color: "#d3f1a7" }, { name: "pink_subtle", color: "#fdd0ec" }, { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" }, { name: "sky", color: "#60c6d2" }, { name: "lime", color: "#94c748" }, { name: "pink", color: "#e774bb" }, { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" }, { name: "sky_bold", color: "#1d7f8c" }, { name: "lime_bold", color: "#5b7f24" }, { name: "pink_bold", color: "#ae4787" }, { name: "grey_bold", color: "#44546f" },
];

interface ManageTagsModalProps {
  children: React.ReactNode;
  selectedTags?: string[];
  onToggleTag?: (tagId: string) => void;
}

export default function ManageTagsModal({ 
  children,
  selectedTags = [],
  onToggleTag
}: ManageTagsModalProps) {
  const { workspaceId } = useParams();
  const { data: tags = [] } = useTags(workspaceId || "");
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [open, setOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagsView, setTagsView] = useState<"list" | "edit">("list");
  
  // Edit State
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedEditColor, setSelectedEditColor] = useState("");
  
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const filteredTags = useMemo(() => {
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(tagSearch.toLowerCase())
    );
  }, [tags, tagSearch]);

  const handleEditLabel = (item: TagType) => {
    setEditingTagId(item._id);
    setEditingName(item.name);
    setSelectedEditColor(item.color);
    setTagsView("edit");
  };

  const handleCreateNewLabel = () => {
    setEditingTagId(null); // null means creating new
    setEditingName("");
    setSelectedEditColor("#4bce97");
    setTagsView("edit");
  };

  const handleSaveEditLabel = () => {
    const trimmedTitle = editingName.trim();
    if (!trimmedTitle || !workspaceId) return;

    if (editingTagId) {
      // Update existing
      updateTag.mutate(
        { tagId: editingTagId, name: trimmedTitle, color: selectedEditColor },
        { onSuccess: () => setTagsView("list") }
      );
    } else {
      // Create new
      createTag.mutate(
        { workspaceId, name: trimmedTitle, color: selectedEditColor },
        { onSuccess: () => setTagsView("list") }
      );
    }
  };

  const handleDeleteLabel = () => {
    if (!editingTagId) return;
    if (confirm("Delete this tag? It will be removed from all stickies.")) {
      deleteTag.mutate(editingTagId, {
        onSuccess: () => setTagsView("list"),
      });
    }
  };

  const renderContent = () => {
    if (tagsView === "edit") {
      return (
        <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-right-2 duration-200">
          <div className="flex items-center px-4 py-3 border-b border-border/50 shrink-0 relative">
            <Button variant="ghost" size="icon" className="size-8 absolute left-2" onClick={() => setTagsView("list")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-center flex-1 w-full flex justify-center">
              {editingTagId ? "Edit tag" : "Create tag"}
            </span>
          </div>

          <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
            <div className="h-10 rounded-sm shadow-none w-full flex items-center px-3" style={{ backgroundColor: selectedEditColor }}>
              {editingName ? (
                <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">
                  {editingName}
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase">Title</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-10 border-[#091e4224] focus-visible:ring-2 ring-black/20 shadow-none border-solid bg-accent/20"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase">Select a color</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_LABEL_COLORS.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedEditColor(item.color)}
                    className="h-8 rounded-sm relative transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    style={{ backgroundColor: item.color }}
                  >
                    {selectedEditColor === item.color ? (
                      <Check className="size-4 text-white drop-shadow-md" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-4">
              <Button onClick={handleSaveEditLabel} disabled={createTag.isPending || updateTag.isPending} className="bg-black hover:bg-black/90 text-white font-semibold h-10 px-6 rounded-sm shadow-sm">
                Save
              </Button>
              {editingTagId && (
                <Button onClick={handleDeleteLabel} disabled={deleteTag.isPending} variant="destructive" className="bg-[#c9372c] hover:bg-[#c9372c]/90 text-white font-semibold h-10 px-6 rounded-sm shadow-sm">
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // List View
    return (
      <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-left-2 duration-200">
        <div className="flex items-center justify-center px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center">Tags</span>
        </div>

        <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              className="h-10 pl-9 border-border focus-visible:ring-2 ring-black/20 transition-all shadow-none"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-muted-foreground">Tags</h4>
            {filteredTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No tags found.</p>
            ) : (
              <div className="space-y-2">
                {filteredTags.map((item) => (
                  <div key={item._id} className="flex items-center gap-3 group">
                    {onToggleTag && (
                      <Checkbox
                        checked={selectedTags.includes(item._id)}
                        onCheckedChange={() => onToggleTag(item._id)}
                        className="size-5 rounded-sm border-zinc-200 data-[state=checked]:bg-black data-[state=checked]:border-black"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => onToggleTag && onToggleTag(item._id)}
                      className="h-10 flex-1 rounded-sm transition-all hover:opacity-85 active:scale-[0.98] shadow-none flex items-center px-3"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.name ? (
                        <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">
                          {item.name}
                        </span>
                      ) : null}
                    </button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditLabel(item)}
                      className="size-8 opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      <SquarePen className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            onClick={handleCreateNewLabel}
            className="w-full bg-[#091e420f] hover:bg-[#091e421a] text-[#172b4d] font-semibold h-10 rounded-sm border-none shadow-none transition-all"
          >
            Create new tag
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setTagsView("list");
      }}
    >
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        onInteractOutside={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.closest("[data-slot='select-content']") || target.closest("[role='option']") || target.closest("[role='listbox']")) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.closest("[data-slot='select-content']") || target.closest("[role='option']") || target.closest("[role='listbox']")) {
            e.preventDefault();
          }
        }}
        className="z-100 flex max-h-[82vh] w-80 min-h-0 flex-col overflow-hidden rounded-sm border-border/50 p-0 shadow-xl"
        style={{ maxHeight: "min(82vh, 760px)" }}
      >
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
}
