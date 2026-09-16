'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Search,
  Filter,
  Star,
  CheckCircle2,
  UserStar,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';
import {
  Button,
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ProjectAvatar,
} from '@/shared/components/ui';
import { useProjects } from '../hooks/use-project';
import { ViewService } from '@/features/projects/project-id/views/services/view.service';
import type { WorkItemViewItem } from '@/features/projects/project-id/views/types/view.types';
import { cn } from '@/shared/lib/utils';

export function WorkspaceViewsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const { projects = [], isLoading: isProjectsLoading } = useProjects();
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);

  const isAllProjects = selectedProjectId === 'all' || !selectedProjectId;
  const targetProjectId = isAllProjects ? '' : selectedProjectId;

  // Fetch views for the targeted project or all active projects
  const { data: views = [], isLoading: isViewsLoading } = useQuery({
    queryKey: ['workspace-views', selectedProjectId, activeProjects.map((p) => p.id).join(',')],
    queryFn: async () => {
      if (!isAllProjects && targetProjectId) {
        const p = activeProjects.find((proj) => proj.id === targetProjectId);
        const res = await ViewService.getViews(targetProjectId);
        return res.map((v) => ({ ...v, projectName: p?.name, projectId: targetProjectId }));
      }
      if (activeProjects.length === 0) return [];
      const results = await Promise.all(
        activeProjects.map(async (p) => {
          try {
            const projectViews = await ViewService.getViews(p.id);
            return projectViews.map((v) => ({ ...v, projectName: p.name, projectId: p.id }));
          } catch {
            return [];
          }
        })
      );
      return results.flat();
    },
    enabled: activeProjects.length > 0,
  });

  const selectedProject = activeProjects.find((p) => p.id === targetProjectId);

  const filteredViews = useMemo(() => {
    if (!searchQuery.trim()) return views;
    const q = searchQuery.toLowerCase();
    return views.filter((v) => v.name?.toLowerCase().includes(q));
  }, [views, searchQuery]);

  // Built-in system views (Plane.so standard)
  const systemViews = [
    {
      id: 'all-issues',
      name: 'All Work Items',
      description: 'Complete inventory across active project',
      icon: Layers,
      href: targetProjectId ? `/projects/${targetProjectId}/work-items` : '/projects',
    },
    {
      id: 'assigned-to-me',
      name: 'Assigned to Me',
      description: 'Tasks currently assigned to your profile',
      icon: UserStar,
      href: '/your-work',
    },
    {
      id: 'urgent-items',
      name: 'Urgent & High Priority',
      description: 'Critical work items requiring immediate attention',
      icon: Sparkles,
      href: targetProjectId ? `/projects/${targetProjectId}/work-items` : '/projects',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Header */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Layers className="size-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Views</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
            {selectedProject ? selectedProject.name : 'Workspace View Library'}
          </span>
        </div>

        {/* Project Selector & Search */}
        <div className="flex items-center gap-2.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted font-normal cursor-pointer"
              >
                {selectedProject ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ProjectAvatar avatar={selectedProject.avatar} name={selectedProject.name} id={selectedProject.id} size="xs" />
                    <span className="truncate max-w-[130px] font-medium">{selectedProject.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers className="size-3.5 text-primary shrink-0" />
                    <span className="font-medium">All Projects</span>
                  </div>
                )}
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
              <DropdownMenuItem
                onClick={() => setSelectedProjectId('all')}
                className={cn('cursor-pointer font-medium flex items-center justify-between', isAllProjects && 'bg-muted font-semibold')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="size-3.5 text-primary shrink-0" />
                  <span>All Projects</span>
                </div>
                {isAllProjects && <Check className="size-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>
              {activeProjects.map((p) => {
                const isSelected = p.id === selectedProjectId;
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={cn('cursor-pointer font-medium flex items-center justify-between', isSelected && 'bg-muted font-semibold')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ProjectAvatar avatar={p.avatar} name={p.name} id={p.id} size="xs" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search views..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 md:w-56 pl-8 pr-3 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
        {/* System Views Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              System Views
            </h2>
            <span className="text-11 text-muted-foreground">Standard perspective lenses</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {systemViews.map((sys) => {
              const Icon = sys.icon;
              return (
                <Link
                  key={sys.id}
                  href={sys.href}
                  className="flex items-start gap-3.5 p-4 rounded-lg border border-border bg-card hover:bg-muted/40 transition-all hover:border-primary/40 group"
                >
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Icon className="size-4 text-primary shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {sys.name}
                    </h3>
                    <p className="text-11 text-muted-foreground mt-0.5 leading-snug">
                      {sys.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Project Custom Saved Views */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Saved Views
              </h2>
              {selectedProject && (
                <span className="text-xs text-foreground font-medium">· {selectedProject.name}</span>
              )}
            </div>
            {targetProjectId && (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer">
                <Link href={`/projects/${targetProjectId}/views`}>
                  <Plus className="size-3 shrink-0" />
                  <span>Manage in Project</span>
                </Link>
              </Button>
            )}
          </div>

          {isViewsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredViews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg bg-card/50">
              <Layers className="size-8 text-muted-foreground/50 mb-2" />
              <h3 className="text-xs font-semibold text-foreground">No saved views</h3>
              <p className="text-11 text-muted-foreground mt-1 max-w-sm">
                {searchQuery
                  ? `No views match "${searchQuery}".`
                  : 'Save filters as custom views inside any project to quickly access them here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredViews.map((view) => (
                <Link
                  key={view.id}
                  href={`/projects/${view.projectId || targetProjectId}/views/${view.id}`}
                  className="flex flex-col justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/40 transition-all hover:border-primary/40 group space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="size-3.5 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {view.name}
                      </span>
                    </div>
                    <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {view.access || 'public'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-10 text-muted-foreground font-mono pt-2 border-t border-border/50">
                    <span className="truncate max-w-[180px]">{(view as any).projectName || selectedProject?.name || 'Project View'}</span>
                    <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkspaceViewsPage;
