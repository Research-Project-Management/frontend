import { useState, useRef } from "react";
import { Plus, Search, Tag, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import ManageLabelsSection from "../section/ManageLabelsModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  savingStatus: "saved" | "saving" | "error";
  lastSavedAt: Date | null;
  onAddNote: () => void;
  isAddingNote: boolean;
  selectedLabels: string[];
  onToggleLabel: (labelId: string) => void;
  addLabel?: string;
  labelType?: string;
  projectId?: string;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  savingStatus,
  lastSavedAt,
  onAddNote,
  isAddingNote,
  selectedLabels,
  onToggleLabel,
  addLabel = "New Sticky",
  labelType = "sticky",
  projectId,
}: TopBarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div
        className={cn(
          "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-sm overflow-hidden group",
          isSearchExpanded || searchQuery ? "w-64 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
        )}
        onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
      >
        <Search 
          className={cn(
            "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 z-10",
            isSearchExpanded || searchQuery 
              ? "left-2.5 translate-x-0 text-muted-foreground/50" 
              : "left-1/2 -translate-x-1/2 text-muted-foreground group-hover:text-foreground"
          )} 
        />
        <Input
          ref={inputRef}
          placeholder="Search by title"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onBlur={() => !searchQuery && setIsSearchExpanded(false)}
          className={cn(
            "h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-all pl-8 pr-8",
            isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          autoFocus={isSearchExpanded}
        />
        {(isSearchExpanded || searchQuery) && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onSearchChange("");
              setIsSearchExpanded(false);
            }}
            className="absolute right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Plus className="size-3.5 rotate-45" />
          </button>
        )}
      </div>

      <Popover open={isLabelsOpen} onOpenChange={setIsLabelsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Tag className="size-3.5" />
            Labels
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={5} className="z-[1000] flex w-80 min-h-0 flex-col overflow-hidden rounded-xl border-border/50 p-0 shadow-xl">
          <ManageLabelsSection 
            selectedLabels={selectedLabels} 
            onToggleLabel={onToggleLabel}
            onClose={() => setIsLabelsOpen(false)}
            type={labelType}
            projectId={projectId}
          />
        </PopoverContent>
      </Popover>

      <Button
        onClick={onAddNote}
        size="sm"
        className="h-8 gap-1.5 rounded-md bg-primary px-3 text-xs text-primary-foreground shadow-none transition-all hover:bg-primary/90"
        disabled={isAddingNote}
      >
        {isAddingNote ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-3.5" />
        )}
        {addLabel}
      </Button>
    </div>
  );
}
