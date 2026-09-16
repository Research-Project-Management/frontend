'use client';

import React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Plus,
  Archive,
  BarChart3,
  UserStar,
  Star,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { DraftsIcon } from "@/shared/components/icons";
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
  return (
    <header
      className="flex items-center justify-between px-4 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
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

        {/* Your Work Page Link */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
          title="View your work"
        >
          <Link className="shrink-0" href="/your-work">
            <UserStar className="size-3.5 text-foreground shrink-0" />
            <span>Your work</span>
          </Link>
        </Button>

        {/* Drafts Page Link */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
          title="View drafts"
        >
          <Link className="shrink-0" href="/drafts">
            <DraftsIcon className="size-3.5 text-foreground shrink-0" />
            <span>Drafts</span>
          </Link>
        </Button>

        {/* Favorites Page Link */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
          title="View favorite projects"
        >
          <Link className="shrink-0" href="/projects/favorite">
            <Star className="size-3.5 text-warning fill-warning shrink-0" />
            <span>Favorites</span>
          </Link>
        </Button>

        {/* Analytics Page Link */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
          title="View analytics"
        >
          <Link className="shrink-0" href="/projects/analytics">
            <BarChart3 className="size-3.5 text-primary shrink-0" />
            <span>Analytics</span>
          </Link>
        </Button>

        {/* Quick Link to Archives */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
          title="View archived projects"
        >
          <Link className="shrink-0" href="/archives">
            <Archive className="size-3.5 text-foreground shrink-0" />
            <span>Archives</span>
            {archivedCount > 0 && (
              <span className="text-xs font-mono tabular-nums px-1 rounded-full bg-muted text-foreground">
                {archivedCount}
              </span>
            )}
          </Link>
        </Button>

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
