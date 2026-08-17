'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Archive,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { ArchiveFilterPopover } from './ArchiveFilterPopover';
import type { Project } from '../../types/project.types';
import type { ProjectFilterCriteria } from '../../utils/projects-page.util';

export type ArchiveTopbarProps = {
  workspaceId: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount?: number;
  isLoading?: boolean;
  projects?: Project[];
  filter?: ProjectFilterCriteria;
  onFilterChange?: (filter: ProjectFilterCriteria) => void;
  currentUserId?: string;
  currentUserName?: string;
};

export function ArchiveTopbar({
  workspaceId,
  searchQuery,
  onSearchChange,
  totalCount = 0,
  isLoading = false,
  projects = [],
  filter,
  onFilterChange,
  currentUserId,
  currentUserName,
}: ArchiveTopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(searchQuery));

  // Shortcut key handling: '/' or 'Cmd/Ctrl+K' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && !e.shiftKey) {
        e.preventDefault();
        setIsSearchExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Icon & Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Archive className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
          Archived
        </h1>
      </div>

      {/* Right: Search & Filter */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search */}
        <div
          role="search"
          tabIndex={isSearchExpanded || searchQuery ? -1 : 0}
          aria-label="Search archived projects"
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
            placeholder="Search archived projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={() => !searchQuery && setIsSearchExpanded(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onSearchChange("");
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
                onSearchChange("");
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
          <ArchiveFilterPopover
            projects={projects}
            filter={filter}
            onFilterChange={onFilterChange}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        )}
      </div>
    </header>
  );
}

export default ArchiveTopbar;
