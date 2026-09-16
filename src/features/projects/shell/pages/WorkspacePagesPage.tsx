'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Search,
  BookOpen,
  Plus,
  Clock,
  ChevronDown,
  Check,
  ExternalLink,
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
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import type { Page } from '@/features/projects/project-id/pages/types/page.types';
import { cn } from '@/shared/lib/utils';

export function WorkspacePagesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const { projects = [], isLoading: isProjectsLoading } = useProjects();
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);

  const targetProjectId = selectedProjectId || (activeProjects.length > 0 ? activeProjects[0].id : '');

  // Fetch pages for the targeted project
  const { data: pages = [], isLoading: isPagesLoading } = useQuery({
    queryKey: ['workspace-pages', targetProjectId],
    queryFn: () => (targetProjectId ? PageService.getProjectPages(targetProjectId) : Promise.resolve([])),
    enabled: Boolean(targetProjectId),
  });

  const selectedProject = activeProjects.find((p) => p.id === targetProjectId);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.toLowerCase();
    return pages.filter((p) => p.title?.toLowerCase().includes(q));
  }, [pages, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Header */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="size-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Pages</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
            {selectedProject ? selectedProject.name : 'Workspace Knowledge Base'}
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
                  <span>Select Project</span>
                )}
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
              {activeProjects.map((p) => {
                const isSelected = p.id === targetProjectId;
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
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 md:w-56 pl-8 pr-3 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {targetProjectId && (
            <Button asChild size="sm" className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-none">
              <Link href={`/projects/${targetProjectId}/pages`}>
                <Plus className="size-3.5 shrink-0" />
                <span>New Page</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documents & Knowledge Pages
          </h2>
          <span className="text-11 text-muted-foreground font-mono">
            {filteredPages.length} document{filteredPages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isPagesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-lg bg-card/40">
            <BookOpen className="size-10 text-muted-foreground/50 mb-2" />
            <h3 className="text-sm font-semibold text-foreground">No documents yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchQuery
                ? `No pages match "${searchQuery}".`
                : 'Create research wiki pages and documentation to organize team knowledge.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
            {filteredPages.map((page) => (
              <div
                key={page.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/30 transition-colors gap-3"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate block">
                      {page.title || 'Untitled Page'}
                    </span>
                    <div className="flex items-center gap-3 text-10 text-muted-foreground font-mono mt-1">
                      {selectedProject && <span>Project: {selectedProject.name}</span>}
                      {page.updatedAt && (
                        <span>Updated: {new Date(page.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer text-foreground hover:bg-muted">
                    <Link href={`/projects/${page.projectId || targetProjectId}/pages`}>
                      <span>Open Doc</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkspacePagesPage;
