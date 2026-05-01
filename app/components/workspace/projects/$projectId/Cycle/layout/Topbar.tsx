import { useState, useRef } from "react";
import { Search, Filter, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface TopBarProps {
  onAddCycle: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function TopBar({
  onAddCycle,
  searchQuery = "",
  onSearchChange,
}: TopBarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-sm overflow-hidden group",
          isSearchExpanded || searchQuery ? "w-48 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
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
          onChange={(e) => onSearchChange?.(e.target.value)}
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
              onSearchChange?.("");
              setIsSearchExpanded(false);
            }}
            className="absolute right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Plus className="size-3.5 rotate-45" />
          </button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-3 rounded-sm border border-border text-muted-foreground hover:bg-muted hover:text-foreground shadow-none bg-background"
      >
        <Filter className="size-3.5" />
        <span className="text-xs font-medium">Filters</span>
      </Button>


      <Button
        onClick={onAddCycle}
        size="sm"
        className="h-8 gap-1.5 rounded-sm px-3 text-xs shadow-none transition-[filter] hover:brightness-110 bg-primary text-primary-foreground"
      >
        <Plus className="size-3.5" />
        New Cycle
      </Button>
    </div>
  );
}
