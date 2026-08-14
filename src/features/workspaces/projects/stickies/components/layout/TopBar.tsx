'use client';

import { useState, useRef } from "react";
import { Plus, Search, Loader2, ListFilter } from "lucide-react";
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

  return (
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

      {onProjectFilterChange && (
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="size-8 rounded-md bg-transparent border-border/60">
              <ListFilter className="size-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="end">
            <Command>
              <div className="p-2 [&_[data-slot=command-input-wrapper]]:border [&_[data-slot=command-input-wrapper]]:border-input [&_[data-slot=command-input-wrapper]]:rounded-md [&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input-wrapper]]:px-2">
                <CommandInput placeholder="Search projects..." className="h-full" />
              </div>
              <CommandList>
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      if (projectFilter.length === 0) return;
                      onProjectFilterChange([]);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={projectFilter.length === 0} 
                      />
                      <span>All</span>
                    </div>
                  </CommandItem>
                  {projects.map((project: any) => {
                    const isSelected = projectFilter.includes(project._id);
                    return (
                      <CommandItem
                        key={project._id}
                        onSelect={() => {
                          if (isSelected) {
                            onProjectFilterChange(projectFilter.filter((id) => id !== project._id));
                          } else {
                            onProjectFilterChange([...projectFilter, project._id]);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Checkbox 
                            checked={isSelected} 
                          />
                          <span className="truncate flex-1">{project.name}</span>
                        </div>
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
