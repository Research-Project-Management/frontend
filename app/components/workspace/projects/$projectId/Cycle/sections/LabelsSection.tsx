import React, { useMemo, useState, useRef } from "react";
import { 
  Check, 
  ChevronLeft, 
  SquarePen, 
  Tag, 
  X,
  Search,
  Plus
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
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from "~/query/tag";
import { useParams } from "react-router";

const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" }, { name: "yellow_subtle", color: "#f8e6a0" }, { name: "orange_subtle", color: "#fedec8" }, { name: "red_subtle", color: "#ffd5d2" }, { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" }, { name: "yellow", color: "#f5cd47" }, { name: "orange", color: "#fea362" }, { name: "red", color: "#f87168" }, { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" }, { name: "yellow_bold", color: "#946f00" }, { name: "orange_bold", color: "#c25100" }, { name: "red_bold", color: "#c9372c" }, { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" }, { name: "sky_subtle", color: "#c6edfb" }, { name: "lime_subtle", color: "#d3f1a7" }, { name: "pink_subtle", color: "#fdd0ec" }, { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" }, { name: "sky", color: "#60c6d2" }, { name: "lime", color: "#94c748" }, { name: "pink", color: "#e774bb" }, { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" }, { name: "sky_bold", color: "#1d7f8c" }, { name: "lime_bold", color: "#5b7f24" }, { name: "pink_bold", color: "#ae4787" }, { name: "grey_bold", color: "#44546f" },
];

interface TagType {
  _id: string;
  name: string;
  color: string;
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
  const [editingName, setEditingName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#4bce97");
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const filteredTags = useMemo(() => {
    return workspaceTags.filter((tag) =>
      tag.name.toLowerCase().includes(labelSearch.toLowerCase())
    );
  }, [workspaceTags, labelSearch]);

  const toggleTag = (id: string) => {
    onChange((prev) =>
      prev.includes(id) ? prev.filter((labelId) => labelId !== id) : [...prev, id]
    );
  };

  const handleEdit = (tag: TagType) => {
    setEditingLabelId(tag._id);
    setEditingName(tag.name);
    setSelectedColor(tag.color);
    setView("edit");
  };

  const handleCreateNew = () => {
    setEditingLabelId(null);
    setEditingName("");
    setSelectedColor("#4bce97");
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
        onSuccess: (newTag: any) => {
          if (newTag?._id) {
            onChange(prev => [...prev, newTag._id]);
          }
          setView("list");
        }
      });
    }
  };

  const handleDelete = () => {
    if (!editingLabelId) return;
    deleteTagMutation.mutate(editingLabelId, {
      onSuccess: () => {
        onChange(prev => prev.filter(id => id !== editingLabelId));
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
              {editingLabelId ? "Edit label" : "Create label"}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
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
                className="h-10 border-[#091e4224] focus-visible:ring-2 ring-primary/20 shadow-none border-none bg-accent/20"
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

            <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-4">
              <Button onClick={handleSave} className="bg-[#0c66e4] hover:bg-[#0c66e4]/90 text-white font-semibold h-10 px-6 rounded-md shadow-sm">
                Save
              </Button>
              {editingLabelId && (
                <Button onClick={handleDelete} variant="destructive" className="bg-[#c9372c] hover:bg-[#c9372c]/90 text-white font-semibold h-10 px-6 rounded-md shadow-sm">
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-left-2 duration-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1">Labels</span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <Input
            placeholder="Search labels..."
            value={labelSearch}
            onChange={(e) => setLabelSearch(e.target.value)}
            className="h-10 border-[#0052cc] focus-visible:ring-2 ring-[#0052cc]/20 transition-all shadow-none"
          />

          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-muted-foreground uppercase">Labels</h4>
            <div className="space-y-2">
              {filteredTags.map((tag) => (
                <div key={tag._id} className="flex items-center gap-3 group">
                  <Checkbox
                    checked={selectedLabelIds.includes(tag._id)}
                    onCheckedChange={() => toggleTag(tag._id)}
                    className="size-5 rounded-lg border-[#091e4224] data-[state=checked]:bg-[#172b4d] data-[state=checked]:border-[#172b4d]"
                  />

                  <button
                    type="button"
                    onClick={() => toggleTag(tag._id)}
                    className="h-10 flex-1 rounded-md transition-all hover:opacity-85 active:scale-[0.98] shadow-none flex items-center px-3"
                    style={{ backgroundColor: tag.color }}
                  >
                    <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">
                      {tag.name}
                    </span>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(tag)}
                    className="size-8 opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <SquarePen className="size-4 text-[#44546f]" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleCreateNew}
            className="w-full bg-[#091e420f] hover:bg-[#091e421a] text-[#172b4d] font-semibold h-10 rounded-md border-none shadow-none transition-all"
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
        sideOffset={8}
        className="z-140 flex max-h-[82vh] w-80 min-h-0 flex-col overflow-hidden rounded-xl border-border/50 p-0 shadow-xl"
        style={{ maxHeight: "min(82vh, 600px)" }}
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
}

export const LabelsSection = ({ workspaceTags, formLabels, setFormLabels }: LabelsSectionProps) => {
  return (
    <LabelSelect 
      selectedLabelIds={formLabels} 
      onChange={setFormLabels} 
      trigger={
        <button className="h-10 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] hover:bg-[#f7f7f7] flex items-center gap-2 transition-colors outline-none">
          <Tag className="size-4 text-[#44546f]" /> Labels
        </button>
      } 
    />
  );
};
