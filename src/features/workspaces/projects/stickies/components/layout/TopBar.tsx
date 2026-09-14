'use client';

import { useState, useRef } from "react";
import { Plus, Search, X } from "lucide-react";
import { StickiesIcon } from "@/shared/components/ui";
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
    <header
      className="flex items-center justify-between px-4 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2.5">
        <StickiesIcon className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">Stickies</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Search */}
        <div
          role="search"
          tabIndex={isSearchExpanded || searchQuery ? -1 : 0}
          aria-label="Search stickies"
          className={cn(
            "relative flex items-center transition-colors duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring",
            isSearchExpanded || searchQuery
              ? "w-64 border border-border bg-background"
              : "w-8 hover:bg-muted cursor-pointer"
          )}
          onClick={() => {
            if (!isSearchExpanded) {
              setIsSearchExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          onKeyDown={(e) => {
            if (!isSearchExpanded && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setIsSearchExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
        >
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 size-3.5 transition-colors duration-300 z-10 text-foreground shrink-0",
              isSearchExpanded || searchQuery
                ? "left-2.5 translate-x-0"
                : "left-1/2 -translate-x-1/2"
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search stickies..."
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
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onSearchChange("");
                setIsSearchExpanded(false);
              }}
              className="absolute right-2.5 text-foreground transition-colors cursor-pointer"
            >
              <X className="size-3.5 text-foreground shrink-0" />
            </button>
          )}
        </div>

        {/* Add Sticky */}
        <Button
          size="sm"
          onClick={onAddSticky}
          disabled={isAddingSticky}
          className="h-8 gap-1.5 rounded-md px-3 text-xs cursor-pointer"
        >
          <Plus className="size-3.5 text-primary-foreground shrink-0" />
          {addLabel}
        </Button>
      </div>
    </header>
  );
}
