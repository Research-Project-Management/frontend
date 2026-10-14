'use client';

import React, { useState, useMemo } from 'react';
import { Hash, ChevronDown, Search, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import type { ProjectSelectorPopoverProps } from '../../types/picker.types';

export type { ProjectSelectorPopoverProps };

export const ProjectSelectorPopover: React.FC<ProjectSelectorPopoverProps> = ({
  open,
  onOpenChange,
  project,
  projects = [],
  onSelectProject,
  disabled = false,
}) => {
  const [search, setSearch] = useState('');

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      (p.name || p.identifier || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const currentId = project?.id;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-normal text-foreground cursor-pointer transition-colors border border-border bg-background hover:bg-background outline-none select-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
            open && 'bg-muted border-border'
          )}
        >
          {project?.emoji ? (
            <span className="text-sm leading-none">{project.emoji}</span>
          ) : (
            <Hash className="size-3.5 text-foreground shrink-0" />
          )}
          <span className="text-xs text-foreground tracking-normal font-normal">
            {project?.name || project?.identifier || 'Select Project'}
          </span>
          <ChevronDown className="size-3 text-foreground ml-0.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1.5 rounded-md border border-border bg-popover shadow-overlay z-100 flex flex-col"
      >
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            className="w-full bg-transparent text-xs outline-none placeholder:text-foreground/70 text-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {filteredProjects.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No projects found
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isSelected = p.id === currentId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectProject(p);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isSelected && 'font-medium'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {p.emoji ? (
                      <span className="text-sm leading-none shrink-0">{p.emoji}</span>
                    ) : (
                      <Hash className="size-3.5 text-foreground shrink-0" />
                    )}
                    <span className="truncate text-foreground text-xs">{p.name || p.identifier}</span>
                  </div>
                  {isSelected && <Check className="size-3.5 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const ProjectPicker = ProjectSelectorPopover;
