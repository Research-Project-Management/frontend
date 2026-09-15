'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  ChevronRight,
  Check,
  Search,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  ProjectAvatar,
} from '@/shared/components/ui';
import { useProjects, useProject } from '@/features/projects/shell/hooks/use-project';
import { cn } from '@/shared/lib/utils';

export interface SwitcherProps {
  project?: {
    id?: string;
    name?: string;
    avatar?: string | null;
  } | null;
  moduleTitle: string;
  moduleIcon?: React.ElementType<{ className?: string }>;
  count?: number;
  className?: string;
  children?: React.ReactNode;
}

export function Switcher({
  project: propProject,
  moduleTitle,
  moduleIcon: ModuleIcon,
  count,
  className,
  children,
}: SwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const currentProjectId = propProject?.id || params?.projectId || '';

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch workspace projects
  const { projects = [] } = useProjects();

  // If project prop wasn't passed or doesn't have name, fetch details
  const { state: projectState } = useProject(currentProjectId, {
    enabled: !propProject?.name && Boolean(currentProjectId),
  });

  const currentProject = useMemo(
    () =>
      propProject?.name
        ? propProject
        : projectState?.project || { id: currentProjectId, name: '', avatar: null },
    [propProject, projectState?.project, currentProjectId],
  );

  const displayName = currentProject.name || 'Select project…';

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  // Combine projects ensuring current project is present
  const allProjects = useMemo(() => {
    if (!currentProjectId) return projects;
    const exists = projects.some((p) => p.id === currentProjectId);
    if (!exists && currentProject?.id) {
      return [currentProject as any, ...projects];
    }
    return projects;
  }, [projects, currentProjectId, currentProject]);

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return allProjects;
    const q = search.toLowerCase();
    return allProjects.filter((p) => p.name?.toLowerCase().includes(q));
  }, [allProjects, search]);

  const handleSelectProject = (newProjectId: string) => {
    setOpen(false);
    if (newProjectId === currentProjectId) return;

    // Smart route replacement to preserve current module
    if (pathname && currentProjectId && pathname.includes(`/projects/${currentProjectId}`)) {
      // If inside a specific sub-item that won't exist in the new project (like cycles/[id] or pages/[id]), normalize to parent module
      const normalizedPath = pathname
        .replace(new RegExp(`/projects/${currentProjectId}/cycles/[^/]+`), `/projects/${currentProjectId}/cycles`)
        .replace(new RegExp(`/projects/${currentProjectId}/pages/[^/]+`), `/projects/${currentProjectId}/pages`);

      const targetPath = normalizedPath.replace(
        `/projects/${currentProjectId}`,
        `/projects/${newProjectId}`
      );
      router.push(targetPath);
    } else {
      router.push(`/projects/${newProjectId}`);
    }
  };

  return (
    <div className={cn('flex items-center gap-2 min-w-0 shrink select-none', className)}>
      {/* 1. Project Switcher */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 h-7 px-1.5 -ml-1 rounded-md text-13 font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 select-none',
              open && 'bg-muted/60',
            )}
          >
            <ProjectAvatar avatar={currentProject.avatar} name={currentProject.name} id={currentProject.id} size="xs" />
            <span className="truncate max-w-[150px] text-13 font-medium text-foreground">
              {displayName}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-56 p-1.5 border border-border bg-popover text-popover-foreground rounded-lg shadow-raised-200 select-none"
        >
          {/* Search Box */}
          <div className="flex items-center gap-2 border border-border/70 rounded-md px-2.5 py-1.5 mb-1 bg-background">
            <Search className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Project List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredProjects.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {search ? 'No projects found' : 'No projects yet'}
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isCurrent = p.id === currentProjectId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProject(p.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left',
                      isCurrent
                        ? 'bg-muted font-medium text-foreground'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <ProjectAvatar avatar={p.avatar} name={p.name} id={p.id} size="xs" />
                    <span className="truncate flex-1 text-xs text-foreground">{p.name}</span>
                    {isCurrent && (
                      <Check className="size-3.5 text-foreground shrink-0 ml-auto" strokeWidth={1.75} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Breadcrumb Separator */}
      <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />

      {/* 2. Module Title */}
      <div className="flex items-center gap-2 h-7 px-1 text-13 font-medium text-foreground select-none shrink-0">
        {ModuleIcon && <ModuleIcon className="size-4 text-foreground shrink-0" />}
        <span className="font-medium text-13 tracking-tight text-foreground truncate">
          {moduleTitle}
        </span>
      </div>

      {/* 3. Optional Breadcrumb Children (e.g. Cycle context or active view context) */}
      {children}
    </div>
  );
}

export default Switcher;

