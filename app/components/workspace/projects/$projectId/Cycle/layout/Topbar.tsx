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
      {/* Expandable Search */}
      <div
        className={cn(
          "relative flex items-center transition-all duration-300 ease-in-out overflow-hidden h-8",
          isSearchExpanded || searchQuery ? "w-48" : "w-8",
        )}
      >
        {isSearchExpanded || searchQuery ? (
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search cycles..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onBlur={() => !searchQuery && setIsSearchExpanded(false)}
              className="pl-8 pr-8 h-8 text-[13px] rounded-sm border border-border bg-background focus-visible:ring-0 shadow-none w-full"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange?.("");
                  setIsSearchExpanded(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setIsSearchExpanded(true)}
          >
            <Search className="size-3.5" />
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-3 rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Filter className="size-3.5" />
        <span className="text-xs font-medium">Filters</span>
      </Button>

      <div className="w-px h-4 bg-border/60 mx-1" />

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
