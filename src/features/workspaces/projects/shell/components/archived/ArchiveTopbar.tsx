'use client';

import React from 'react';
import { Archive } from 'lucide-react';
import { ArchiveFilterPopover } from './ArchiveFilterPopover';
import { CollapsibleSearchInput } from '../project/CollapsibleSearchInput';
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

  return (
    <header
      className="flex items-center justify-between px-4 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
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
        <CollapsibleSearchInput
          placeholder="Search archived projects..."
          value={searchQuery}
          onChange={onSearchChange}
          ariaLabel="Search archived projects"
        />

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
