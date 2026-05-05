import React from "react";
import { 
  Search, 
  Check, 
  ChevronLeft, 
  SquarePen, 
  X 
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { useParams } from "react-router";
import { useLabels } from "~/hooks/useLabels";
import { AVAILABLE_LABEL_COLORS } from "~/query/label";

interface ManageLabelsSectionProps {
  selectedLabels?: string[];
  onToggleLabel?: (labelId: string) => void;
  onClose?: () => void;
  type?: string;
  projectId?: string;
}

export default function ManageLabelsSection({ 
  selectedLabels = [],
  onToggleLabel,
  onClose,
  type = "sticky",
  projectId: propProjectId
}: ManageLabelsSectionProps) {
  const { workspaceId, projectId: routeProjectId } = useParams();
  const projectId = propProjectId !== undefined ? propProjectId : routeProjectId;

  const {
    filteredLabels,
    view,
    setView,
    labelSearch,
    setLabelSearch,
    editingLabelId,
    editingName,
    setEditingName,
    selectedColor,
    setSelectedColor,
    handleCreateNew,
    handleEdit,
    handleSave,
    handleDelete,
    isMutating
  } = useLabels(workspaceId!, type, projectId);

  const toggleLabel = (labelId: string) => {
    onToggleLabel?.(labelId);
  };

  const handleScrollableWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollContainer = event.currentTarget;
    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) return;
    event.stopPropagation();
  };

  const renderContent = () => {
    if (view === "edit") {
      return (
        <div className="flex h-full min-h-0 flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-8" 
              onClick={() => setView("list")}
              disabled={isMutating}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-center flex-1">
              {editingLabelId ? "Edit label" : "Create label"}
            </span>
            {onClose && (
              <Button variant="ghost" size="icon" className="size-8" onClick={onClose} disabled={isMutating}>
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-5 custom-scrollbar" onWheel={handleScrollableWheel}>
            <div 
              className="h-10 rounded-md shadow-none w-full flex items-center px-3 transition-colors duration-200" 
              style={{ backgroundColor: selectedColor }}
            >
              {editingName && (
                <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">
                  {editingName}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">Title</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-9 border-[#d9d9d9] bg-white shadow-none transition-all focus-visible:border-[#202222] focus-visible:ring-1 focus-visible:ring-[#202222]/20"
                autoFocus
                disabled={isMutating}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">Select a color</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_LABEL_COLORS.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedColor(item.color)}
                    disabled={isMutating}
                    className="h-8 rounded-lg relative transition-all hover:scale-105 active:scale-95 flex items-center justify-center disabled:opacity-50"
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
            <Button 
              onClick={() => handleSave()} 
              disabled={isMutating || !editingName.trim()}
              className="bg-black hover:bg-black/90 text-white font-semibold h-9 px-6 rounded-md shadow-sm min-w-[80px]"
            >
              {isMutating ? "Save" : "Save"}
            </Button>
            {editingLabelId && (
              <Button 
                onClick={() => handleDelete((id) => {
                  if (selectedLabels.includes(id)) {
                    toggleLabel(id);
                  }
                })} 
                variant="destructive" 
                disabled={isMutating}
                className="bg-[#c9372c] hover:bg-[#c9372c]/90 text-white font-semibold h-9 px-6 rounded-md shadow-sm min-w-[80px]"
              >
                {isMutating ? "Delete" : "Delete"}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1">Labels</span>
          {onClose && (
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="shrink-0 bg-white px-4 pb-2 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#44546f] z-10" />
            <Input 
              placeholder="Search labels..." 
              value={labelSearch} 
              onChange={(e) => setLabelSearch(e.target.value)} 
              className="h-9 border-[#d9d9d9] bg-white pl-9 text-[15px] shadow-none transition-all focus-visible:border-[#202222] focus-visible:ring-1 focus-visible:ring-[#202222]/20" 
            />
          </div>
        </div>

        <div className="shrink-0 bg-white px-4 pt-2">
          <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">Labels</h4>
        </div>

        <div 
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 custom-scrollbar" 
          style={{ maxHeight: "336px" }}
          onWheel={handleScrollableWheel}
        >
          <div className="space-y-2">
            {filteredLabels.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <p className="text-[13px] font-medium text-muted-foreground/60">
                  {labelSearch ? "No labels match your search" : "No labels created yet"}
                </p>
              </div>
            ) : (
              filteredLabels.map((label: any) => (
                <div key={label._id} className="grid h-10 grid-cols-[20px_minmax(0,1fr)_32px] items-center gap-3 group">
                  <Checkbox 
                    checked={selectedLabels.includes(label._id)} 
                    onCheckedChange={() => toggleLabel(label._id)}
                    className="size-5 rounded-lg border-[#091e4224] data-[state=checked]:bg-[#172b4d] data-[state=checked]:border-[#172b4d]" 
                  />
                  <button
                    type="button"
                    onClick={() => toggleLabel(label._id)}
                    className="flex h-10 min-w-0 items-center rounded-md px-3 shadow-none transition-all hover:opacity-85 active:scale-[0.98]"
                    style={{ backgroundColor: label.color }}
                  >
                    <span className="min-w-0 max-w-full truncate text-xs font-bold text-white drop-shadow-sm">
                      {label.name}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(label)}
                    className="size-8 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                  >
                    <SquarePen className="size-4 text-[#44546f]" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 bg-muted/30 px-2 pb-3 pt-2">
          <Button 
            variant="secondary" 
            onClick={handleCreateNew}
            className="h-10 w-full rounded-md border-none bg-[#091e420f] font-semibold text-[#172b4d] shadow-none transition-all hover:bg-[#091e421a]"
          >
            Create a new label
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div key={view} className="flex flex-col h-full animate-in fade-in duration-200">
      {renderContent()}
    </div>
  );
}
