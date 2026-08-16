'use client';

import React from "react";
import { 
  Check, 
  ChevronLeft, 
  Search,
  SquarePen, 
  Tag, 
  X
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { useParams } from "next/navigation";
import { useLabels, AVAILABLE_LABEL_COLORS } from '../../hooks/use-label';

const LabelSelect = ({ 
  selectedLabelIds = [], 
  onChange, 
  trigger 
}: { 
  selectedLabelIds: string[]; 
  onChange: React.Dispatch<React.SetStateAction<string[]>>; 
  trigger?: React.ReactNode;
}) => {
  const { workspaceId, projectId } = useParams() as { workspaceId: string, projectId: string };
  const [isOpen, setIsOpen] = React.useState(false);

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
  } = useLabels(workspaceId!, "cycle", projectId);

  const toggleTag = (tagId: string) => {
    onChange((prev) => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleScrollableWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollContainer = event.currentTarget;
    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) return;
    event.stopPropagation();
  };

  const renderContent = () => {
    if (view === "edit") {
      return (
        <div className="flex h-full min-h-0 flex-col bg-popover">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <Button variant="ghost" size="icon" className="size-8 text-foreground hover:bg-muted cursor-pointer" onClick={() => setView("list")} disabled={isMutating} aria-label="Back to label list">
              <ChevronLeft className="size-4 text-foreground" />
            </Button>
            <span className="text-sm font-semibold text-center flex-1 text-foreground">
              {editingLabelId ? "Edit label" : "Create label"}
            </span>
            <Button variant="ghost" size="icon" className="size-8 text-foreground hover:bg-muted cursor-pointer" onClick={() => setIsOpen(false)} disabled={isMutating} aria-label="Close label editor">
              <X className="size-4 text-foreground" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-5 custom-scrollbar" onWheel={handleScrollableWheel}>
            <div className="h-10 rounded-md shadow-none w-full flex items-center px-3" style={{ backgroundColor: selectedColor }}>
              {editingName && <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">{editingName}</span>}
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">Title</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-9 border-border bg-background shadow-none transition-all focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
                disabled={isMutating}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">Select a color</Label>
              <div className="grid grid-cols-5 gap-2">

                {AVAILABLE_LABEL_COLORS.map((item: any) => (
                  <button 
                    key={item.name} 
                    onClick={() => setSelectedColor(item.color)} 
                    disabled={isMutating}
                    className="h-8 rounded-lg relative transition-transform hover:scale-105 active:scale-95 flex items-center justify-center disabled:opacity-50 cursor-pointer" 
                    style={{ backgroundColor: item.color }}
                  >
                    {selectedColor === item.color && <Check className="size-4 text-white drop-shadow-md" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-border/50 bg-popover p-3">
            <Button 
              onClick={() => handleSave()} 
              disabled={isMutating || !editingName.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-6 rounded-md shadow-sm min-w-20 cursor-pointer"
            >
              {isMutating ? "Saving..." : "Save"}
            </Button>
            {editingLabelId && (
              <Button 
                onClick={() => handleDelete((id: any) => onChange(prev => prev.filter(p => p !== id)))} 
                variant="destructive" 
                disabled={isMutating}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold h-9 px-6 rounded-md shadow-sm min-w-20 cursor-pointer"
              >
                {isMutating ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col bg-popover overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1 text-foreground">Labels</span>
          <Button variant="ghost" size="icon" className="size-7 text-foreground hover:bg-muted cursor-pointer" onClick={() => setIsOpen(false)} aria-label="Close label popover"><X className="size-4 text-foreground" /></Button>
        </div>
        <div className="shrink-0 bg-popover px-4 pb-2 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground z-10" />
            <Input 
              placeholder="Search labels..." 
              value={labelSearch} 
              onChange={(e) => setLabelSearch(e.target.value)} 
              className="h-9 border-border bg-background pl-9 text-[15px] shadow-none transition-all focus-visible:ring-1 focus-visible:ring-primary" 
            />
          </div>
        </div>
        <div className="shrink-0 bg-popover px-4 pt-2">
          <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide">Labels</h4>
        </div>

        <div 
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 custom-scrollbar" 
          style={{ maxHeight: "336px" }} 
          onWheel={handleScrollableWheel}
        >
          <div className="space-y-2">
            {filteredLabels.length > 0 ? (
              filteredLabels.map((label: any) => (
                <div key={label._id} className="grid h-10 grid-cols-[20px_minmax(0,1fr)_32px] items-center gap-3 group">
                  <Checkbox 
                    checked={selectedLabelIds.includes(label._id)} 
                    onCheckedChange={() => toggleTag(label._id)} 
                    className="size-5 rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                  />
                  <button 
                    type="button" 
                    onClick={() => toggleTag(label._id)} 
                    className="flex h-10 min-w-0 items-center rounded-md px-3 shadow-none transition-all hover:opacity-85 active:scale-[0.98] cursor-pointer" 
                    style={{ backgroundColor: label.color }}
                  >
                    <span className="min-w-0 max-w-full truncate text-xs font-bold text-white drop-shadow-sm">{label.name}</span>
                  </button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleEdit(label)} 
                    className="size-8 shrink-0 opacity-60 transition-opacity group-hover:opacity-100 text-foreground hover:bg-muted cursor-pointer"
                    aria-label={`Edit ${label.name}`}
                  >
                    <SquarePen className="size-4 text-foreground" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Tag className="size-6 text-foreground/40" />
                </div>
                <p className="text-[14px] font-medium text-foreground">
                  {labelSearch ? "No labels found" : "No labels yet"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {labelSearch 
                    ? `We couldn't find any labels matching "${labelSearch}"`
                    : "Create your first label to start organizing."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 bg-muted/30 px-2 pb-3 pt-2">
          <Button 
            variant="secondary" 
            onClick={handleCreateNew} 
            className="h-10 w-full rounded-md border-none bg-muted font-semibold text-foreground shadow-none transition-all hover:bg-muted/80 cursor-pointer"
          >
            Create a new label
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={(val) => { setIsOpen(val); if(!val) setView("list"); }}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" className="h-10 rounded-lg border-border bg-background px-4 text-[14px] font-semibold text-foreground shadow-none hover:bg-muted cursor-pointer"><Tag className="mr-2 h-4 w-4 text-foreground" />Labels</Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-150}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="z-[1000] flex w-80 min-h-0 flex-col overflow-hidden rounded-lg border-border p-0 shadow-xl bg-popover"
        style={{ height: view === "edit" ? 560 : "auto", maxHeight: "calc(100vh - 24px)" }}
      >
        <div key={view} className="flex flex-col h-full animate-in fade-in duration-200">
          {renderContent()}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const Labels = ({ 
  formLabels, 
  setFormLabels, 
  triggerRef 
}: { 
  formLabels: string[]; 
  setFormLabels: React.Dispatch<React.SetStateAction<string[]>>; 
  triggerRef?: React.Ref<HTMLButtonElement>; 
}) => {
  return (
    <LabelSelect 
      selectedLabelIds={formLabels} 
      onChange={setFormLabels} 
      trigger={
        <button 
          ref={triggerRef} 
          className="h-10 rounded-sm border border-border bg-background px-4 text-[15px] font-medium text-foreground hover:bg-muted flex items-center gap-2 transition-colors outline-none cursor-pointer"
        >
          <Tag className="size-4 text-foreground" /> Labels
        </button>
      } 
    />
  );
};

export const LabelsSection = Labels;

