import { useState, useRef } from "react";
import { Plus, Search, Tag, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import ManageTagsModal from "../modals/ManageTagsModal";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  savingStatus: "saved" | "saving" | "error";
  lastSavedAt: Date | null;
  onAddNote: () => void;
  isAddingNote: boolean;
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  savingStatus,
  lastSavedAt,
  onAddNote,
  isAddingNote,
  selectedTags,
  onToggleTag,
}: TopBarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3 shrink-0">
      {/* Expandable Search */}
      <div
        className={cn(
          "relative flex items-center transition-all duration-300 ease-in-out overflow-hidden h-8",
          isSearchExpanded ? "w-64" : "w-8",
        )}
      >
        {isSearchExpanded ? (
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search stickies..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={() => !searchQuery && setIsSearchExpanded(false)}
              className="pl-8 pr-8 h-8 text-[13px] rounded-sm border border-border/60 bg-background focus-visible:ring-0 shadow-none w-full"
              autoFocus
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSearchChange("");
                setIsSearchExpanded(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <Plus className="size-3.5 rotate-45" />
            </button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-sm hover:bg-secondary/60"
            onClick={() => setIsSearchExpanded(true)}
          >
            <Search className="size-4" />
          </Button>
        )}
      </div>

      <ManageTagsModal selectedTags={selectedTags} onToggleTag={onToggleTag}>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <Tag className="size-3.5" />
          Tags
        </Button>
      </ManageTagsModal>

      <Button
        onClick={onAddNote}
        size="sm"
        className="h-8 gap-1.5 text-xs font-semibold"
        disabled={isAddingNote}
      >
        {isAddingNote ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        New Sticky
      </Button>
    </div>
  );
}
