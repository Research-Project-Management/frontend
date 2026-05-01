import React, { useMemo, useState } from "react";
import { 
  Check, 
  ChevronLeft, 
  Search,
  SquarePen, 
  Tag, 
  X
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from "~/query/sticky";
import { useParams } from "react-router";

const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" }, { name: "yellow_subtle", color: "#f8e6a0" }, { name: "orange_subtle", color: "#fedec8" }, { name: "red_subtle", color: "#ffd5d2" }, { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" }, { name: "yellow", color: "#f5cd47" }, { name: "orange", color: "#fea362" }, { name: "red", color: "#f87168" }, { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" }, { name: "yellow_bold", color: "#946f00" }, { name: "orange_bold", color: "#c25100" }, { name: "red_bold", color: "#c9372c" }, { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" }, { name: "sky_subtle", color: "#c6edfb" }, { name: "lime_subtle", color: "#d3f1a7" }, { name: "pink_subtle", color: "#fdd0ec" }, { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" }, { name: "sky", color: "#60c6d2" }, { name: "lime", color: "#94c748" }, { name: "pink", color: "#e774bb" }, { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" }, { name: "sky_bold", color: "#1d7f8c" }, { name: "lime_bold", color: "#5b7f24" }, { name: "pink_bold", color: "#ae4787" }, { name: "grey_bold", color: "#44546f" },
];

const DEFAULT_LABEL_COLORS = [
  "#579dff",
  "#f5cd47",
  "#9f8fef",
  "#f87168",
  "#4bce97",
  "#60c6d2",
  "#8590a2",
];

const LEGACY_DEFAULT_LABEL_NAMES = new Set([
  "todo",
  "in progress",
  "review",
  "blocked",
  "done",
]);

const MAX_VISIBLE_LABEL_ROWS = 7;
const LABEL_ROW_HEIGHT = 40;
const LABEL_ROW_GAP = 8;
const LABEL_LIST_VERTICAL_PADDING = 22;
const LABEL_POPOVER_CHROME_HEIGHT = 198;

interface TagType {
  _id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LabelSelectProps {
  selectedLabelIds: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  trigger?: React.ReactNode;
}

export const LabelSelect = ({ selectedLabelIds, onChange, trigger }: LabelSelectProps) => {
  const { workspaceId } = useParams();
  const { data: workspaceTags = [] } = useTags(workspaceId!);
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  const deleteTagMutation = useDeleteTag();

  const [isOpen, setIsOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingDefaultColor, setEditingDefaultColor] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#4bce97");
  const [defaultLabelColors, setDefaultLabelColors] = useState(DEFAULT_LABEL_COLORS);
  const [createdLabelIds, setCreatedLabelIds] = useState<string[]>([]);

  const handleScrollableWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollContainer = event.currentTarget;

    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    scrollContainer.scrollTop += event.deltaY;
  };

  const filteredTags = useMemo(() => {
    const normalizedSearch = labelSearch.toLowerCase();
    const getTagTime = (tag: TagType) => {
      const timestamp = tag.createdAt || tag.updatedAt;
      if (!timestamp) return null;

      const parsedTime = Date.parse(timestamp);
      return Number.isNaN(parsedTime) ? null : parsedTime;
    };

    return workspaceTags
      .map((tag, index) => ({ tag, index }))
      .filter(({ tag }) => {
        const normalizedName = tag.name.trim().toLowerCase();

        return (
          !LEGACY_DEFAULT_LABEL_NAMES.has(normalizedName) &&
          normalizedName.includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        const aCreatedOrder = createdLabelIds.indexOf(a.tag._id);
        const bCreatedOrder = createdLabelIds.indexOf(b.tag._id);
        const aCreatedInSession = aCreatedOrder !== -1;
        const bCreatedInSession = bCreatedOrder !== -1;

        if (aCreatedInSession && bCreatedInSession) {
          return aCreatedOrder - bCreatedOrder;
        }

        if (aCreatedInSession) return 1;
        if (bCreatedInSession) return -1;

        const aTime = getTagTime(a.tag);
        const bTime = getTagTime(b.tag);

        if (aTime !== null && bTime !== null && aTime !== bTime) {
          return aTime - bTime;
        }

        return a.index - b.index;
      })
      .map(({ tag }) => tag);
  }, [workspaceTags, labelSearch, createdLabelIds]);

  const visibleDefaultColors = useMemo(() => {
    if (labelSearch) return [];

    return defaultLabelColors;
  }, [defaultLabelColors, labelSearch]);

  const totalLabelRowCount = filteredTags.length + visibleDefaultColors.length;
  const visibleLabelRowCount = Math.min(totalLabelRowCount, MAX_VISIBLE_LABEL_ROWS);
  const visibleRowsHeight =
    visibleLabelRowCount > 0
      ? visibleLabelRowCount * LABEL_ROW_HEIGHT +
        (visibleLabelRowCount - 1) * LABEL_ROW_GAP
      : 0;
  const labelListScrollHeight = LABEL_LIST_VERTICAL_PADDING + visibleRowsHeight;

  const labelListHeight = Math.min(
    560,
    LABEL_POPOVER_CHROME_HEIGHT + labelListScrollHeight
  );

  const toggleTag = (id: string) => {
    onChange((prev) =>
      prev.includes(id) ? prev.filter((labelId) => labelId !== id) : [...prev, id]
    );
  };

  const handleEdit = (tag: TagType) => {
    setEditingLabelId(tag._id);
    setEditingDefaultColor(null);
    setEditingName(tag.name);
    setSelectedColor(tag.color);
    setView("edit");
  };

  const handleCreateNew = () => {
    setEditingLabelId(null);
    setEditingDefaultColor(null);
    setEditingName("");
    setSelectedColor("#4bce97");
    setView("edit");
  };

  const handleCreateFromDefaultColor = (color: string) => {
    setEditingLabelId(null);
    setEditingDefaultColor(color);
    setEditingName("");
    setSelectedColor(color);
    setView("edit");
  };

  const handleSave = () => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;

    if (editingLabelId) {
      updateTagMutation.mutate({
        tagId: editingLabelId,
        name: trimmedName,
        color: selectedColor,
      }, {
        onSuccess: () => setView("list")
      });
    } else {
      createTagMutation.mutate({
        workspaceId: workspaceId!,
        name: trimmedName,
        color: selectedColor,
      }, {
        onSuccess: (response: any) => {
          const createdTag = response?.tag || response;

          if (createdTag?._id) {
            setCreatedLabelIds((prev) =>
              prev.includes(createdTag._id) ? prev : [...prev, createdTag._id]
            );
          }
          if (editingDefaultColor) {
            setDefaultLabelColors((prev) =>
              prev.filter((color) => color !== editingDefaultColor)
            );
            setEditingDefaultColor(null);
          }
          setView("list");
        }
      });
    }
  };

  const handleDelete = () => {
    if (editingDefaultColor) {
      setDefaultLabelColors((prev) =>
        prev.filter((color) => color !== editingDefaultColor)
      );
      setEditingDefaultColor(null);
      setView("list");
      return;
    }

    if (!editingLabelId) return;
    deleteTagMutation.mutate(editingLabelId, {
      onSuccess: () => {
        onChange(prev => prev.filter(id => id !== editingLabelId));
        setCreatedLabelIds((prev) => prev.filter((id) => id !== editingLabelId));
        setEditingLabelId(null);
        setView("list");
      }
    });
  };

  const renderContent = () => {
    if (view === "edit") {
      return (
        <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-right-2 duration-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setView("list")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-center flex-1">
              {editingLabelId || editingDefaultColor ? "Edit label" : "Create label"}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-5 custom-scrollbar"
            onWheel={handleScrollableWheel}
          >
            <div className="h-10 rounded-md shadow-none w-full flex items-center px-3" style={{ backgroundColor: selectedColor }}>
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
                className="h-9 border-[#d9d9d9] bg-white shadow-none transition-all focus-visible:border-[#202222] focus-visible:ring-1 focus-visible:ring-[#202222]/20"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase">Select a color</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_LABEL_COLORS.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedColor(item.color)}
                    className="h-8 rounded-lg relative transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    style={{ backgroundColor: item.color }}
                  >
                    {selectedColor === item.color && (
                      <Check className="size-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-border/50 bg-white p-3">
            <Button onClick={handleSave} className="bg-[#0c66e4] hover:bg-[#0c66e4]/90 text-white font-semibold h-9 px-6 rounded-md shadow-sm">
              Save
            </Button>
            {(editingLabelId || editingDefaultColor) && (
              <Button onClick={handleDelete} variant="destructive" className="bg-[#c9372c] hover:bg-[#c9372c]/90 text-white font-semibold h-9 px-6 rounded-md shadow-sm">
                Delete
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-left-2 duration-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1">Labels</span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setIsOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="shrink-0 bg-white px-4 pb-2 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#44546f]" />
            <Input
              placeholder="Search labels..."
              value={labelSearch}
              onChange={(e) => setLabelSearch(e.target.value)}
              className="h-9 border-[#d9d9d9] bg-white pl-9 text-[15px] shadow-none transition-all focus-visible:border-[#202222] focus-visible:ring-1 focus-visible:ring-[#202222]/20"
            />
          </div>
        </div>

        <div className="shrink-0 bg-white px-4 pt-2">
          <h4 className="text-[13px] font-bold text-muted-foreground uppercase">Labels</h4>
        </div>

        <div
          className="min-h-0 shrink-0 overflow-y-auto overscroll-contain px-4 pb-3.5 pt-2 custom-scrollbar"
          style={{ height: labelListScrollHeight }}
          onWheel={handleScrollableWheel}
        >
          <div className="space-y-2">
            {filteredTags.map((tag) => (
              <div key={tag._id} className="grid grid-cols-[20px_minmax(0,1fr)_32px] items-center gap-3 group">
                <Checkbox
                  checked={selectedLabelIds.includes(tag._id)}
                  onCheckedChange={() => toggleTag(tag._id)}
                  className="size-5 rounded-lg border-[#091e4224] data-[state=checked]:bg-[#172b4d] data-[state=checked]:border-[#172b4d]"
                />

                <button
                  type="button"
                  onClick={() => toggleTag(tag._id)}
                  className="flex h-10 min-w-0 items-center rounded-md px-3 shadow-none transition-all hover:opacity-85 active:scale-[0.98]"
                  style={{ backgroundColor: tag.color }}
                >
                  <span className="min-w-0 max-w-full truncate text-xs font-bold text-white drop-shadow-sm">
                    {tag.name}
                  </span>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(tag)}
                  className="size-8 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                >
                  <SquarePen className="size-4 text-[#44546f]" />
                </Button>
              </div>
            ))}

            {visibleDefaultColors.map((color) => (
              <div key={color} className="grid grid-cols-[20px_minmax(0,1fr)_32px] items-center gap-3">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => handleCreateFromDefaultColor(color)}
                  className="size-5 rounded-lg border-[#091e4224] data-[state=checked]:bg-[#172b4d] data-[state=checked]:border-[#172b4d]"
                  aria-label="Create label from color"
                />

                <button
                  type="button"
                  onClick={() => handleCreateFromDefaultColor(color)}
                  className="flex h-10 min-w-0 items-center rounded-md shadow-none transition-all hover:opacity-85 active:scale-[0.98]"
                  style={{ backgroundColor: color }}
                  aria-label="Create label from color"
                >
                  <span className="sr-only">Create label from color</span>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCreateFromDefaultColor(color)}
                  className="size-8 shrink-0 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Create label from color"
                >
                  <SquarePen className="size-4 text-[#44546f]" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 bg-muted/30 px-2 pb-3 pt-2">
          <Button
            variant="secondary"
            onClick={handleCreateNew}
            className="h-10 w-full rounded-md border-none bg-[#091e420f] font-semibold text-[#172b4d] shadow-none transition-all hover:bg-[#091e421a]"
          >
            Create new label
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={(val) => { setIsOpen(val); if(!val) setView("list"); }}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" className="h-10 rounded-xl border-border/50 bg-white px-4 text-[14px] font-semibold text-[#172b4d] shadow-none hover:bg-accent/50">
            <Tag className="mr-2 h-4 w-4" />Labels
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-150}
        className="z-140 flex w-80 min-h-0 flex-col overflow-hidden rounded-xl border-border/50 p-0 shadow-xl"
        style={{
          height: view === "edit" ? 560 : labelListHeight,
          maxHeight: "calc(100vh - 24px)"
        }}
      >
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
};

interface LabelsSectionProps {
  workspaceTags: TagType[];
  formLabels: string[];
  setFormLabels: React.Dispatch<React.SetStateAction<string[]>>;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

export const LabelsSection = ({ workspaceTags, formLabels, setFormLabels, triggerRef }: LabelsSectionProps) => {
  return (
    <LabelSelect 
      selectedLabelIds={formLabels} 
      onChange={setFormLabels} 
      trigger={
        <button ref={triggerRef} className="h-10 rounded-sm border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] hover:bg-[#f7f7f7] flex items-center gap-2 transition-colors outline-none">
          <Tag className="size-4 text-[#44546f]" /> Labels
        </button>
      } 
    />
  );
};
