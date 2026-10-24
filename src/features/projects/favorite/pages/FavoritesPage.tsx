'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Star,
  Plus,
  Briefcase,
  ArrowUpDown,
  LayoutGrid,
  List,
  BarChart3,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  WorkspaceCardGridSkeleton,
  WorkspaceViewTransition,
} from '@/shared/components/layout/WorkspaceSkeleton';
import { Card } from '@/features/projects/shell/components/project/Card';
import { CollapsibleSearchInput } from '@/features/projects/shell/components/project/CollapsibleSearchInput';

const CreateProjectModal = dynamic(
  () =>
    import('@/features/projects/shell/components/project/CreateProjectModal').then(
      (m) => m.CreateProjectModal
    ),
  { ssr: false }
);
import { useProjectsQuery } from '@/features/projects/shell/hooks/use-project';
import { useFavorites } from '../hooks/use-favorites';
import {
  filterActiveProjects,
  sortProjects,
  searchProjects,
  type ProjectSortOption,
} from '@/features/projects/shell/utils/projects-page.util';
import { cn } from '@/shared/lib/utils';

type ViewMode = 'grid' | 'list';

export function FavoritesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ProjectSortOption>('updated');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flux:projects-view-mode') as ViewMode | null;
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved);
      }
    } catch {
      // Fallback
    }
  }, []);

  const { projects: rawProjects = [], isLoading } = useProjectsQuery();
  const { favoriteIds } = useFavorites();

  const favoriteProjects = useMemo(() => {
    const active = filterActiveProjects(rawProjects);
    return active.filter((p) => favoriteIds.has(p.id));
  }, [rawProjects, favoriteIds]);

  const filteredProjects = useMemo(() => {
    const searched = searchProjects(favoriteProjects, searchQuery);
    return sortProjects(searched, sortBy);
  }, [favoriteProjects, searchQuery, sortBy]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Topbar */}
      <header
        className="flex items-center justify-between px-4 h-11 border-b border-border bg-background sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
      >
        {/* Left: Star Icon, Title & Count */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Star className="size-4 text-warning fill-warning shrink-0" />
          <h1 className="text-13 font-semibold text-foreground tracking-tight">
            Favorites
          </h1>
          {favoriteProjects.length > 0 && (
            <span className="text-11 font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border shrink-0">
              {favoriteProjects.length}
            </span>
          )}
        </div>

        {/* Right: Search & Quick Links */}
        <div className="flex items-center gap-2 shrink-0">
          <CollapsibleSearchInput
            placeholder="Search favorites..."
            value={searchQuery}
            onChange={setSearchQuery}
            ariaLabel="Search favorite projects"
          />

          <Button
            asChild
            variant="outline"
            size="sm"
            className="relative h-8 px-2.5 text-12 font-medium gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer shadow-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
            title="All projects"
          >
            <Link className="shrink-0" href="/projects">
              <Briefcase className="size-3.5 text-foreground shrink-0" />
              <span>Projects</span>
            </Link>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="relative h-8 gap-1.5 px-3 text-13 font-medium shadow-none cursor-pointer focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
          >
            <Plus className="size-3.5 text-primary-foreground" />
            <span>New project</span>
          </Button>
        </div>
      </header>

      {/* Secondary Toolbar: Sort + View Mode (only if there are favorites) */}
      {favoriteProjects.length > 0 && (
        <div className="flex items-center justify-between px-4 h-9 border-b border-border/60 bg-background shrink-0 select-none text-12">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BarChart3 className="size-3.5 text-foreground shrink-0" />
            <span>
              Showing <strong className="text-foreground font-medium">{filteredProjects.length}</strong> starred{' '}
              {filteredProjects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative h-7 px-2 text-12 font-normal gap-1.5 text-foreground hover:bg-muted cursor-pointer focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
                >
                  <ArrowUpDown className="size-3 text-foreground" />
                  <span>
                    Sort:{' '}
                    {sortBy === 'updated'
                      ? 'Last updated'
                      : sortBy === 'created'
                        ? 'Created date'
                        : 'Name'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setSortBy('updated')} className="text-12 cursor-pointer">
                  Last updated
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('created')} className="text-12 cursor-pointer">
                  Created date
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name')} className="text-12 cursor-pointer">
                  Name (A-Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => React.startTransition(() => setViewMode('grid'))}
                className={cn(
                  'relative p-1 rounded cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-[\'\']',
                  viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => React.startTransition(() => setViewMode('list'))}
                className={cn(
                  'relative p-1 rounded cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-[\'\']',
                  viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title="List view"
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {isLoading && <WorkspaceCardGridSkeleton variant="projects" count={4} />}

        {!isLoading && favoriteProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center select-none">
            <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center mb-3">
              <Star className="size-6 text-warning fill-warning" />
            </div>
            <h2 className="text-16 font-semibold text-foreground">No favorite projects yet</h2>
            <p className="text-13 text-muted-foreground mt-1 max-w-sm">
              Click the star icon on any project card or from the sidebar menu to pin your most important projects here.
            </p>
            <Button asChild size="sm" className="relative mt-4 h-8 px-3 text-13 font-medium cursor-pointer shadow-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']">
              <Link href="/projects">Browse all projects</Link>
            </Button>
          </div>
        )}

        {!isLoading && favoriteProjects.length > 0 && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center select-none">
            <p className="text-13 text-muted-foreground">
              No favorite projects match your search &quot;{searchQuery}&quot;.
            </p>
          </div>
        )}

        {!isLoading && filteredProjects.length > 0 && (
          <WorkspaceViewTransition>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredProjects.map((project) => (
                  <Card key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredProjects.map((project) => (
                  <Card key={project.id} project={project} />
                ))}
              </div>
            )}
          </WorkspaceViewTransition>
        )}
      </main>

      {isCreateOpen && (
        <CreateProjectModal
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
        />
      )}
    </div>
  );
}

export default FavoritesPage;
