import { useState, useRef } from "react";
import { Plus, Search, Tag, Loader2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import ManageTagsModal from "../modals/ManageTagsModal";
import { useTags } from "~/query/sticky";
import { useParams } from "react-router";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNote: () => void;
  isAddingNote: boolean;
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  onAddNote,
  isAddingNote,
  selectedTags,
  onToggleTag,
}: TopBarProps) {
  const { workspaceId } = useParams();
  const { data: allTags = [] } = useTags(workspaceId || "");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the actual tag objects for the selected IDs
  const activeTags = allTags.filter(t => selectedTags.includes(t._id));

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

      <ManageTagsModal selectedTags={selectedTags} onToggleTag={onToggleTag}>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-xs font-medium border-border/60 shadow-none hover:bg-secondary/60"
        >
          <Tag className="size-3.5" />
          Tags
        </Button>
      </ManageTagsModal>

      <Button
        onClick={onAddNote}
        size="sm"
        className="h-8 gap-1.5 text-xs font-semibold px-3"
        disabled={isAddingNote}
      >
        {isAddingNote ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        New Note
      </Button>
    </div>
  );
}
