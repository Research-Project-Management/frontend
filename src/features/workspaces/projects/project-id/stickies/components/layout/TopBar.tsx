'use client';

import { useState, useRef } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddSticky: () => void;
  isAddingSticky: boolean;
  addLabel?: string;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  onAddSticky,
  isAddingSticky,
  addLabel = "New Sticky",
}: TopBarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div
        className={cn(
          "relative flex items-center transition-colors duration-300 ease-in-out h-8 rounded-lg overflow-hidden group",
          isSearchExpanded || searchQuery ? "w-64 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
        )}
        onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
      >
        <Search 
          className={cn(
            "absolute top-1/2 -translate-y-1/2 size-3.5 transition-colors duration-300 z-10",
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
            "h-full text-sm py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity pl-8 pr-8",
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


      <Button
        size="sm"
        className="h-8 gap-1.5"
        onClick={onAddSticky}
        disabled={isAddingSticky}
      >
        {isAddingSticky ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {addLabel}
      </Button>
    </div>
  );
}
