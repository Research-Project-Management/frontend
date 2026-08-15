'use client';

import { useState, useRef } from "react";
import { Plus, Search, Layers2, ListFilter } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useParams } from "next/navigation";
import { useWorkspaceProjects } from '@/features/workspaces/projects/shell/services/project.services';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Checkbox } from "@/shared/components/ui/checkbox";

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
  const projects = availableProjectIds ? allProjects.filter((p: any) => availableProjectIds.includes(p._id)) : allProjects;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleProject = (projectId: string) => {
    if (!onProjectFilterChange) return;
    if (projectFilter.includes(projectId)) {
      onProjectFilterChange(projectFilter.filter((id) => id !== projectId));
    } else {
      onProjectFilterChange([...projectFilter, projectId]);
    }
  };

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
        <div
          className={cn(
            "relative flex items-center transition-colors duration-300 ease-in-out h-8 rounded-md overflow-hidden group",
            isSearchExpanded || searchQuery ? "w-64 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
          )}
          onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
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
              className="absolute right-2.5 text-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3.5 rotate-45 text-foreground" />
            </button>
          )}
        </div>

        {onProjectFilterChange && (
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 gap-2 border-border/50 bg-background hover:bg-secondary/80 text-xs font-normal text-foreground cursor-pointer",
                  projectFilter.length > 0 && "border-primary/50 text-primary bg-primary/5"
                )}
              >
                <ListFilter className="size-3.5 text-foreground" />
                <span>Projects</span>
                {projectFilter.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                    {projectFilter.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 p-0 bg-popover"
              align="end"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <Command>
                <CommandInput placeholder="Filter projects..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                    No project found.
                  </CommandEmpty>
                  <CommandGroup>
                    {projects.map((project: any) => {
                      const isSelected = projectFilter.includes(project._id);
                      return (
                        <CommandItem
                          key={project._id}
                          onSelect={() => toggleProject(project._id)}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer"
                        >
                          <Checkbox checked={isSelected} className="size-3.5 rounded-sm" />
                          <span className="truncate">{project.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

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
