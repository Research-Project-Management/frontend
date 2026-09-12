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
import { Button } from '@/shared/components/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui';
import { Skeleton } from '@/shared/components/ui';
import { Card } from '../components/project/Card';
import { CollapsibleSearchInput } from '../components/project/CollapsibleSearchInput';
import { CreateProjectModal } from '../components/project/CreateProjectModal';
import { useProjects } from '../hooks/use-project';
import { useFavorites } from '../hooks/use-favorites';
import {
  filterActiveProjects,
  sortProjects,
  searchProjects,
  type ProjectSortOption,
} from '../utils/projects-page.util';
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

  const { projects: rawProjects = [], isLoading } = useProjects();
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
        className="flex items-center justify-between px-4 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
      >
        {/* Left: Star Icon, Title & Count */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Star className="size-4 text-warning fill-warning shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Favorites
          </h1>
          {favoriteProjects.length > 0 && (
            <span className="text-xs font-mono tabular-nums px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border shrink-0">
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
            className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
            title="All projects"
          >
            <Link className="shrink-0" href="/projects">
              <Briefcase className="size-3.5 text-foreground shrink-0" />
              <span>Projects</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted inline-flex cursor-pointer"
            title="Analytics"
          >
            <Link className="shrink-0" href="/projects/analytics">
              <BarChart3 className="size-3.5 text-foreground shrink-0" />
              <span>Analytics</span>
            </Link>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-none cursor-pointer"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New Project</span>
          </Button>
        </div>
      </header>

      {/* Toolbar: Sort & View Mode */}
      {favoriteProjects.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-border bg-muted select-none shrink-0"
          style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
        >
          <div className="text-xs text-muted-foreground">
            Showing {filteredProjects.length} of {favoriteProjects.length} favorite {favoriteProjects.length === 1 ? 'project' : 'projects'}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer border border-border"
                >
                  <ArrowUpDown className="size-3 text-foreground shrink-0" />
                  <span>
                    {sortBy === 'updated'
                      ? 'Recently updated'
                      : sortBy === 'name'
                        ? 'Name (A-Z)'
                        : 'Newest created'}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1 text-xs">
                <DropdownMenuItem
                  onClick={() => setSortBy('updated')}
                  className={cn('cursor-pointer font-medium', sortBy === 'updated' && 'font-semibold text-primary')}
                >
                  Recently updated
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy('name')}
                  className={cn('cursor-pointer font-medium', sortBy === 'name' && 'font-semibold text-primary')}
                >
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy('created')}
                  className={cn('cursor-pointer font-medium', sortBy === 'created' && 'font-semibold text-primary')}
                >
                  Newest created
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode */}
            <div className="flex items-center border border-border rounded-md p-0.5 bg-background">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1 rounded cursor-pointer transition-colors',
                  viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1 rounded cursor-pointer transition-colors',
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
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse">
                <Skeleton className="h-24 w-full rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && favoriteProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center select-none">
            <div className="size-12 rounded-full bg-warning/10 flex items-center justify-center mb-3">
              <Star className="size-6 text-warning fill-warning" />
            </div>
            <h2 className="text-base font-semibold text-foreground">No favorite projects yet</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Click the star icon on any project card or from the sidebar menu to pin your most important projects here.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/projects">Browse all projects</Link>
            </Button>
          </div>
        )}

        {!isLoading && favoriteProjects.length > 0 && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center select-none">
            <p className="text-sm text-muted-foreground">
              No favorite projects match your search &quot;{searchQuery}&quot;.
            </p>
          </div>
        )}

        {!isLoading && filteredProjects.length > 0 && (
          viewMode === 'grid' ? (
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
          )
        )}
      </main>

      <CreateProjectModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}

export default FavoritesPage;
