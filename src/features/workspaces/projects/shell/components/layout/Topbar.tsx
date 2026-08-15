'use client';

import React, { useState } from "react";
import {
  Briefcase,
  Search,
  Plus,
  X,
} from "lucide-react";
import {
  Button,
  Input,
} from "@/shared/components/ui";

type TopbarProps = {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAddProjectClick: () => void;
};

export function Topbar({ searchQuery = "", onSearchChange, onAddProjectClick }: TopbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(searchQuery));

  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      {/* Left: Icon & Title */}
      <div className="flex items-center gap-2.5">
        <Briefcase className="size-4 text-foreground" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          Projects
        </h1>
      </div>

      {/* Right: Search & Add Project */}
      <div className="flex items-center gap-2">
        {/* Search Bar / Search Button */}
        {isSearchExpanded ? (
          <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground" />
            <Input
              autoFocus
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="h-8 w-48 sm:w-64 pl-8 pr-8 text-xs bg-muted/40 border-border"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange?.("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground/80 cursor-pointer p-0.5"
              >
                <X className="size-3.5 text-foreground" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchExpanded(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground/80 cursor-pointer p-0.5"
              >
                <X className="size-3.5 text-foreground" />
              </button>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSearchExpanded(true)}
            className="h-8 w-8 p-0 border-border/80 bg-background/50 hover:bg-accent text-foreground cursor-pointer"
            title="Search projects"
          >
            <Search className="size-3.5 text-foreground" />
          </Button>
        )}

        {/* New Project CTA Button */}
        <Button
          size="sm"
          onClick={onAddProjectClick}
          className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-none cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>New Project</span>
        </Button>
      </div>
    </header>
  );
}

export default Topbar;
