'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Plus,
  Briefcase,
  LayoutGrid,
  List,
  Globe,
  Lock,
  ArrowUpDown,
  Archive,
  MoreHorizontal,
  Link2,
  Settings,
  UserSquare2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Skeleton,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { CreateProjectModal } from '../components/project/CreateProjectModal';
import { Topbar } from '../components/project/Topbar';
import { Card } from '../components/project/Card';
import { useProjects, useArchiveProject } from '../hooks/use-project';
import { useAuth } from '@/features/auth';
import {
  filterActiveProjects,
  filterProjectsByVisibility,
  filterProjectsByCriteria,
  searchProjects,
  sortProjects,
  calculateProjectFilterCounts,
  isProjectPrivate,
  type ProjectVisibilityFilter,
  type ProjectSortOption,
  type ProjectFilterCriteria,
} from '../utils/projects-page.util';
import { filterArchivedProjects } from '../utils/archive-page.util';
import { cn } from '@/shared/lib/utils';
import type { Project } from '../types/project.types';

type ViewMode = 'grid' | 'list';

function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden h-48 animate-pulse">
      <div className="h-24 bg-muted/40" />
      <div className="pt-6 px-4 pb-4 space-y-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const { user } = useAuth();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ProjectVisibilityFilter>('all');
  const [popoverFilter, setPopoverFilter] = useState<ProjectFilterCriteria>({
    myProjects: false,
    access: [],
    leads: [],
    members: [],
    createdDate: 'all',
  });
  const [sortBy, setSortBy] = useState<ProjectSortOption>('updated');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('flux:projects-view-mode') as ViewMode) || 'grid';
    }
    return 'grid';
  });

  const { projects: rawProjects = [], isLoading, isError } = useProjects(workspaceId);
  const archiveProjectMutation = useArchiveProject();

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('flux:projects-view-mode', mode);
    } catch {
      // Fallback
    }
  };

  // Active vs Archived split via Pure Utils
  const activeProjects = useMemo(() => {
    return filterActiveProjects(rawProjects);
  }, [rawProjects]);

  const archivedCount = useMemo(() => {
    return filterArchivedProjects(rawProjects).length;
  }, [rawProjects]);

  // Counts for filter tabs (All, Public, Private)
  const filterCounts = useMemo(() => {
    return calculateProjectFilterCounts(activeProjects);
  }, [activeProjects]);

  // Filter & Search & Sort via Pure Utils
  const filteredProjects = useMemo(() => {
    const byVisibility = filterProjectsByVisibility(activeProjects, activeFilter);
    const byCriteria = filterProjectsByCriteria(
      byVisibility,
      popoverFilter,
      user?._id || (user as any)?.id
    );
    const searched = searchProjects(byCriteria, searchQuery);
    return sortProjects(searched, sortBy);
  }, [activeProjects, activeFilter, popoverFilter, searchQuery, sortBy, user]);

  const handleArchiveProject = (projectId: string) => {
    archiveProjectMutation.mutate({ projectId });
  };

  const handleCopyLink = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(
        `${window.location.origin}/${workspaceId}/projects/${projectId}/overview`
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Topbar */}
      <Topbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddProjectClick={() => setIsCreateOpen(true)}
        totalProjectsCount={activeProjects.length}
        archivedCount={archivedCount}
        projects={activeProjects}
        filter={popoverFilter}
        onFilterChange={setPopoverFilter}
        currentUserId={user?._id || (user as any)?.id}
        currentUserName={user?.name || 'You'}
      />

      {/* Toolbar: Filter Tabs (All, Public, Private), Sort & View Mode */}
      {activeProjects.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-border/40 bg-muted/15 select-none shrink-0"
          style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
        >
          {/* Left: Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto min-w-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0',
                activeFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <span>All Projects</span>
              <span className="text-[10px] font-mono tabular-nums px-1 rounded-full bg-muted/60">
                {filterCounts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('public')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0',
                activeFilter === 'public'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Globe className="size-3 text-muted-foreground" />
              <span>Public</span>
              {filterCounts.public > 0 && (
                <span className="text-[10px] font-mono tabular-nums px-1 rounded-full bg-muted/60">
                  {filterCounts.public}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFilter('private')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0',
                activeFilter === 'private'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Lock className="size-3 text-muted-foreground" />
              <span>Private</span>
              {filterCounts.private > 0 && (
                <span className="text-[10px] font-mono tabular-nums px-1 rounded-full bg-muted/60">
                  {filterCounts.private}
                </span>
              )}
            </button>
          </div>

          {/* Right: Sort Dropdown & View Mode Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer border border-border/40"
                >
                  <ArrowUpDown className="size-3 text-muted-foreground" />
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

            {/* View Mode Switcher */}
            <div className="flex items-center p-0.5 bg-muted/40 rounded-lg border border-border/40">
              <button
                type="button"
                onClick={() => handleSetViewMode('grid')}
                className={cn(
                  'p-1 rounded-md transition-all cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('list')}
                className={cn(
                  'p-1 rounded-md transition-all cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
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
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="size-12 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-semibold text-foreground">Failed to load projects</h3>
              <p className="text-xs text-muted-foreground">
                There was a problem communicating with the server. Please check your connection and try again.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2 text-xs cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Reload page</span>
            </Button>
          </div>
        )}

        {/* Loaded Projects - Grid View */}
        {!isLoading && !isError && viewMode === 'grid' && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 min-w-0">
            {filteredProjects.map((project) => (
              <Card
                key={project._id || (project as any).id}
                project={project}
                workspaceId={workspaceId}
                onArchive={handleArchiveProject}
              />
            ))}
          </div>
        )}

        {/* Loaded Projects - List View */}
        {!isLoading && !isError && viewMode === 'list' && filteredProjects.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs divide-y divide-border/40">
            {filteredProjects.map((project) => {
              const projectId = project._id || (project as any).id || '';
              const projectKey = (project as any).key || project.identifier || 'PROJ';
              const isPrivate = isProjectPrivate(project);

              const leadMember = project.members?.find(
                (m: any) => m.role === 'manager' || m.role === 'lead' || m.role === 'owner' || m.role === 'admin'
              );
              const leadUser =
                leadMember?.user ||
                (project.createdBy?._id || (project.createdBy as any)?.id ? project.createdBy : null);

              return (
                <div
                  key={projectId}
                  className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/20 transition-colors text-xs"
                >
                  {/* Left: Avatar + Title + Key + Description */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-8 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center text-base shrink-0 font-semibold text-foreground">
                      {project.avatar ? (
                        <span>{project.avatar}</span>
                      ) : (
                        <span>{project.name ? project.name.charAt(0).toUpperCase() : 'P'}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/${workspaceId}/projects/${projectId}/overview`}
                          className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                        >
                          {project.name}
                        </Link>
                        <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase px-1 py-0.2 rounded bg-muted/60 border border-border/40 shrink-0">
                          {projectKey}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-xl">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle: Lead & Visibility */}
                  <div className="hidden md:flex items-center gap-6 shrink-0 text-muted-foreground">
                    {/* Lead */}
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      {leadUser ? (
                        <>
                          <Avatar className="size-4 shrink-0">
                            <AvatarImage src={leadUser.avatar} alt={leadUser.name} />
                            <AvatarFallback className="text-[8px] bg-muted">
                              {leadUser.name ? leadUser.name.charAt(0).toUpperCase() : 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[100px] text-[11px]">{leadUser.name || 'Lead'}</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic">No lead</span>
                      )}
                    </div>

                    {/* Visibility */}
                    <div className="w-16 flex items-center gap-1 text-[11px]">
                      {isPrivate ? (
                        <>
                          <Lock className="size-3 text-muted-foreground" />
                          <span>Private</span>
                        </>
                      ) : (
                        <>
                          <Globe className="size-3 text-muted-foreground" />
                          <span>Public</span>
                        </>
                      )}
                    </div>

                    {/* Status */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Joined
                    </span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 flex items-center justify-center transition-colors cursor-pointer"
                          title="More options"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-1.5 text-xs">
                        <DropdownMenuItem
                          onClick={(e) => handleCopyLink(projectId, e)}
                          className="cursor-pointer font-medium flex items-center gap-2"
                        >
                          <Link2 className="size-3.5" />
                          <span>Copy link</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer font-medium">
                          <Link
                            href={`/${workspaceId}/projects/${projectId}/settings`}
                            className="flex items-center gap-2 w-full"
                          >
                            <Settings className="size-3.5" />
                            <span>Settings</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleArchiveProject(projectId)}
                          className="cursor-pointer font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2"
                        >
                          <Archive className="size-3.5" />
                          <span>Archive project</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state: 0 active projects in workspace */}
        {!isLoading && !isError && activeProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center select-none animate-in fade-in duration-300">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="absolute inset-0 size-16 rounded-full bg-foreground/[0.03] blur-xl -z-10" />
              <Briefcase className="size-10 stroke-[1.25] text-muted-foreground/35" />
            </div>
            <div className="space-y-1 max-w-sm px-4">
              <h3 className="text-sm font-medium text-foreground tracking-tight">No projects yet</h3>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                Projects organize research tasks, cycles, and collaborative notes in your workspace.
              </p>
            </div>
          </div>
        )}

        {/* Empty state: Search / Filter query matched 0 projects */}
        {!isLoading && !isError && activeProjects.length > 0 && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center select-none animate-in fade-in duration-300">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="absolute inset-0 size-16 rounded-full bg-foreground/[0.03] blur-xl -z-10" />
              <Briefcase className="size-10 stroke-[1.25] text-muted-foreground/35" />
            </div>
            <div className="space-y-1 max-w-sm px-4 mb-3">
              <h3 className="text-sm font-medium text-foreground tracking-tight">No matching projects</h3>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                No projects matched your active search query or filter.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-7 px-2.5"
                >
                  Show all projects
                </Button>
              )}
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer h-7 px-2.5"
                >
                  Clear search
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          onCloseAutoFocus={(e: Event) => e.preventDefault()}
          className="sm:max-w-xl bg-popover"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">New Project</DialogTitle>
          </DialogHeader>
          <CreateProjectModal onSuccess={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectsPage;
