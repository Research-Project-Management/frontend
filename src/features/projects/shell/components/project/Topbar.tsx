'use client';

import React from 'react';
import {
  Briefcase,
  Plus,
  Upload,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { ProjectFilterPopover } from './ProjectFilterPopover';
import { CollapsibleSearchInput } from './CollapsibleSearchInput';
import type { Project } from '../../types/project.types';
import type { ProjectFilterCriteria } from '../../utils/projects-page.util';

export type TopbarProps = {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAddProjectClick: () => void;
  onUploadProjectZipClick?: () => void;
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
  onUploadProjectZipClick,
  totalProjectsCount,
  archivedCount = 0,
  projects = [],
  filter,
  onFilterChange,
  currentUserId,
  currentUserName,
}: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-border bg-transparent sticky top-0 z-20 shrink-0 select-none min-w-0 overflow-x-auto scrollbar-none"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Icon, Title & Project Count */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <Briefcase className="size-4 text-foreground shrink-0" />
        <h1 className="text-13 font-semibold text-foreground tracking-tight">
          Projects
        </h1>
        {totalProjectsCount !== undefined && totalProjectsCount > 0 && (
          <span className="text-11 font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-muted text-foreground border border-border shrink-0">
            {totalProjectsCount}
          </span>
        )}
      </div>

      {/* Right: Search, Filter, Archives Link & Add Project */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        {/* Search matching sticky style */}
        <CollapsibleSearchInput
          placeholder="Search projects..."
          value={searchQuery}
          onChange={onSearchChange}
          ariaLabel="Search projects"
        />

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



        {/* New Project Dropdown / CTA Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 px-3 text-12 font-medium shadow-none cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              New project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1 text-12 shadow-overlay">
            <DropdownMenuItem onClick={onAddProjectClick} className="gap-2 cursor-pointer">
              <Plus className="size-3.5 text-muted-foreground" />
              <span>Blank Project</span>
            </DropdownMenuItem>
            {onUploadProjectZipClick && (
              <DropdownMenuItem onClick={onUploadProjectZipClick} className="gap-2 cursor-pointer">
                <Upload className="size-3.5 text-muted-foreground" />
                <span>Upload Project (.zip)</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Topbar;
