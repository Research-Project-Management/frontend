'use client';

import { useState, useRef, useMemo } from "react";
import { Plus, Search, Layers2, ListFilter, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { useParams } from "next/navigation";
import { useWorkspaceProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddSticky: () => void;
  isAddingSticky: boolean;
  addLabel?: string;
  projectFilter?: string[];
  onProjectFilterChange?: (projectIds: string[]) => void;
  availableProjectIds?: string[];
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  onAddSticky,
  isAddingSticky,
  addLabel = "New Sticky",
  projectFilter = [],
  onProjectFilterChange,
  availableProjectIds,
}: TopBarProps) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { projects: allProjects = [] } = useWorkspaceProjects(workspaceId || "");
  const projects = availableProjectIds
    ? allProjects.filter((p: any) => availableProjectIds.includes(p._id || p.id))
    : allProjects;

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter((p: any) => p.name?.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  const toggleProject = (projectId: string) => {
    if (!onProjectFilterChange) return;
    if (projectFilter.includes(projectId)) {
      onProjectFilterChange(projectFilter.filter((id) => id !== projectId));
    } else {
      onProjectFilterChange([...projectFilter, projectId]);
    }
  };

  const clearAllFilters = () => {
    if (!onProjectFilterChange) return;
    onProjectFilterChange([]);
    setProjectSearch("");
  };

  const hasActiveFilters = projectFilter.length > 0;

  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-3">
        <Layers2 className="size-4 text-foreground" />
        <h1 className="text-sm font-semibold text-foreground">Stickies</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Search */}
        <div
          role="search"
          tabIndex={isSearchExpanded || searchQuery ? -1 : 0}
          aria-label="Search stickies by title"
          className={cn(
            "relative flex items-center transition-colors duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring",
            isSearchExpanded || searchQuery
              ? "w-64 border border-border/50 bg-background"
              : "w-8 hover:bg-secondary/80 cursor-pointer"
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
              "absolute top-1/2 -translate-y-1/2 size-3.5 transition-colors duration-300 z-10 text-foreground",
              isSearchExpanded || searchQuery
                ? "left-2.5 translate-x-0"
                : "left-1/2 -translate-x-1/2"
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search by title..."
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
              className="absolute right-2.5 text-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-3.5 text-foreground" />
            </button>
          )}
        </div>

        {/* Filter Popover */}
        {onProjectFilterChange && (
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Filter stickies by project"
                className={cn(
                  "h-8 gap-1.5 border-border/60 bg-background hover:bg-secondary/80 text-xs font-normal text-foreground cursor-pointer transition-colors",
                  hasActiveFilters && "border-primary/50 text-primary bg-primary/5 hover:bg-primary/10"
                )}
              >
                <ListFilter className="size-3.5" />
                <span>Filter</span>
                {hasActiveFilters && (
                  <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-semibold text-primary leading-none">
                    {projectFilter.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-3 bg-popover border border-border shadow-xl rounded-lg space-y-3"
              align="end"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Projects {hasActiveFilters && `(${projectFilter.length})`}
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="size-3" />
                    Clear all
                  </button>
                )}
              </div>

              {/* Search input if projects > 3 */}
              {projects.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="h-7 text-xs pl-7 pr-2 bg-muted/40 border-border/60 focus-visible:ring-1"
                  />
                </div>
              )}

              {/* Projects List */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredProjects.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted-foreground">
                    No projects found
                  </div>
                ) : (
                  filteredProjects.map((project: any) => {
                    const pId = project._id || project.id;
                    const isSelected = projectFilter.includes(pId);
                    return (
                      <button
                        key={pId}
                        type="button"
                        onClick={() => toggleProject(pId)}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors text-left cursor-pointer",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="size-5 rounded flex items-center justify-center bg-muted text-[10px] font-bold shrink-0">
                            {project.name?.charAt(0).toUpperCase() || "P"}
                          </span>
                          <span className="truncate">{project.name}</span>
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Add Sticky */}
        <Button
          size="sm"
          onClick={onAddSticky}
          disabled={isAddingSticky}
          className="h-8 gap-1.5 rounded-lg px-3 text-xs cursor-pointer"
        >
          <Plus className="size-3.5 text-primary-foreground" />
          {addLabel}
        </Button>
      </div>
    </header>
  );
}
