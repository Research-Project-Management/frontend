'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Briefcase,
  Search,
  Plus,
  X,
  Archive,
} from 'lucide-react';
import { Button, Input } from '@/shared/components/ui';
import { useHotkeys } from '@/shared/hooks/use-hotkeys';
import { cn } from '@/shared/lib/utils';
import { ProjectFilterPopover } from './ProjectFilterPopover';
import type { Project } from '../../types/project.types';
import type { ProjectFilterCriteria } from '../../utils/projects-page.util';

export type TopbarProps = {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAddProjectClick: () => void;
  totalProjectsCount?: number;
  archivedCount?: number;
  projects?: Project[];
  filter?: ProjectFilterCriteria;
  onFilterChange?: (filter: ProjectFilterCriteria) => void;
  currentUserId?: string;
  currentUserName?: string;
};

export function Topbar({
  searchQuery = '',
  onSearchChange,
  onAddProjectClick,
  totalProjectsCount,
  archivedCount = 0,
  projects = [],
  filter,
  onFilterChange,
  currentUserId,
  currentUserName,
}: TopbarProps) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(searchQuery));

  // Shortcut key handling: '/' or 'Cmd/Ctrl+K' focuses search input
  useHotkeys(['/', 'mod+k'], () => {
    setIsSearchExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  });

  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Icon, Title & Project Count */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Briefcase className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          Projects
        </h1>
        {totalProjectsCount !== undefined && totalProjectsCount > 0 && (
          <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/40 shrink-0">
            {totalProjectsCount}
          </span>
        )}
      </div>

      {/* Right: Search, Filter, Archives Link & Add Project */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search matching sticky style */}
        <div
          role="search"
          tabIndex={isSearchExpanded || searchQuery ? -1 : 0}
          aria-label="Search projects"
          className={cn(
            "relative flex items-center transition-colors duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring",
            isSearchExpanded || searchQuery
              ? "w-48 sm:w-64 border border-border/50 bg-background"
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
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onBlur={() => !searchQuery && setIsSearchExpanded(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onSearchChange?.("");
                setIsSearchExpanded(false);
              }
            }}
            className={cn(
              "h-full text-xs py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-7",
              isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSearchChange?.("");
                setIsSearchExpanded(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/70 hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Popover */}
        {filter && onFilterChange && (
          <ProjectFilterPopover
            projects={projects}
            filter={filter}
            onFilterChange={onFilterChange}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        )}

        {/* Quick Link to Archives (if any archived) */}
        {workspaceId && archivedCount > 0 && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground hidden sm:inline-flex cursor-pointer"
            title="View archived projects"
          >
            <Link href={`/${workspaceId}/projects/archives`}>
              <Archive className="size-3.5" />
              <span>Archives</span>
              <span className="text-[10px] font-mono tabular-nums px-1 rounded-full bg-muted">
                {archivedCount}
              </span>
            </Link>
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
