'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Briefcase,
  Plus,
  Archive,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { ProjectFilterPopover } from './ProjectFilterPopover';
import { CollapsibleSearchInput } from './CollapsibleSearchInput';
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

  return (
    <header
      className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Icon, Title & Project Count */}
      <div className="flex items-center gap-2.5 min-w-0">
        <Briefcase className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          Projects
        </h1>
        {totalProjectsCount !== undefined && totalProjectsCount > 0 && (
          <span className="text-xs font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border shrink-0">
            {totalProjectsCount}
          </span>
        )}
      </div>

      {/* Right: Search, Filter, Archives Link & Add Project */}
      <div className="flex items-center gap-2 shrink-0">
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

        {/* Quick Link to Archives (if any archived) */}
        {workspaceId && archivedCount > 0 && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted hidden sm:inline-flex cursor-pointer"
            title="View archived projects"
          >
            <Link href={`/${workspaceId}/projects/archives`}>
              <Archive className="size-3.5 text-foreground shrink-0" />
              <span>Archives</span>
              <span className="text-xs font-mono tabular-nums px-1 rounded-full bg-muted text-foreground">
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
          <Plus className="size-3.5 shrink-0" />
          <span>New Project</span>
        </Button>
      </div>
    </header>
  );
}

export default Topbar;
