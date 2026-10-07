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
} from '@/shared/components/ui/popover';
import { ProjectAvatar } from '@/shared/components/icons';
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

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch workspace projects
  const { projects = [], isLoading: isProjectsLoading } = useProjects();

  // Resolve current project ID with multi-layer fallback
  const currentProjectId = useMemo(() => {
    if (propProject?.id) return propProject.id;
    if (params?.projectId) return params.projectId;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('flux_active_project_id');
        if (stored && projects.some((p) => p.id === stored)) return stored;
      } catch {}
    }
    return projects[0]?.id || '';
  }, [propProject?.id, params?.projectId, projects]);

  // Synchronously look up from projects list (instant cache hit)
  const projectFromList = useMemo(() => {
    if (!currentProjectId) return null;
    return (
      projects.find(
        (p) => p.id === currentProjectId || (p as any).identifier === currentProjectId
      ) || null
    );
  }, [projects, currentProjectId]);

  // Fetch single project detail if not found in list and name is missing
  const shouldFetchDetail = Boolean(
    currentProjectId && !propProject?.name && !projectFromList?.name
  );
  const { state: projectState, isLoading: isProjectDetailLoading } = useProject(currentProjectId, {
    enabled: shouldFetchDetail,
  });

  const currentProject = useMemo(() => {
    if (propProject?.name) {
      return {
        id: propProject.id || currentProjectId,
        name: propProject.name,
        avatar: propProject.avatar ?? null,
      };
    }
    if (projectFromList?.name) {
      return {
        id: projectFromList.id,
        name: projectFromList.name,
        avatar: projectFromList.avatar ?? null,
      };
    }
    if (projectState?.project?.name) {
      return {
        id: projectState.project.id,
        name: projectState.project.name,
        avatar: projectState.project.avatar ?? null,
      };
    }
    return {
      id: currentProjectId,
      name: '',
      avatar: null,
    };
  }, [propProject, projectFromList, projectState?.project, currentProjectId]);

  // Sync active project to localStorage whenever resolved
  useEffect(() => {
    if (currentProject.id && currentProject.name && typeof window !== 'undefined') {
      try {
        localStorage.setItem('flux_active_project_id', currentProject.id);
      } catch {}
    }
  }, [currentProject.id, currentProject.name]);

  const isResolving =
    Boolean(currentProjectId) &&
    !currentProject.name &&
    (isProjectsLoading || (shouldFetchDetail && isProjectDetailLoading));

  const displayName = currentProject.name || (isResolving ? 'Loading…' : 'Select project…');

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

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('flux_active_project_id', newProjectId);
      } catch {}
    }

    // Smart route replacement to preserve current module
    if (pathname && currentProjectId && pathname.includes(`/projects/${currentProjectId}`)) {
      // If inside a specific sub-item that won't exist in the new project (like pages/[id]), normalize to parent module
      const normalizedPath = pathname.replace(
        new RegExp(`/projects/${currentProjectId}/pages/[^/]+`),
        `/projects/${currentProjectId}/pages`
      );

      const targetPath = normalizedPath.replace(
        `/projects/${currentProjectId}`,
        `/projects/${newProjectId}`
      );
      router.push(targetPath);
    } else if (pathname && pathname.includes('/pages')) {
      router.push(`/projects/${newProjectId}/pages`);
    } else {
      router.push(`/projects/${newProjectId}`);
    }
  };

  return (
    <div className={cn('flex items-center gap-1 sm:gap-1.5 shrink-0 select-none min-w-0', className)}>
      {/* 1. Project Breadcrumb Item */}
      <div className="flex items-center gap-1.5 sm:gap-2 h-7 px-1 -ml-1 text-13 font-medium text-foreground shrink-0 select-none">
        <ProjectAvatar avatar={currentProject.avatar} name={currentProject.name} id={currentProject.id} size="xs" />
        <span className="truncate max-w-[110px] sm:max-w-[170px] text-13 font-medium text-foreground">
          {displayName}
        </span>
      </div>

      {/* Horizontal Arrow Icon: Breadcrumb Separator & Project Switcher Popover Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Switch project"
            title="Switch project"
            className={cn(
              'size-6 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer outline-none relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring shrink-0',
              open && 'bg-muted/60 text-foreground',
            )}
          >
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform duration-200 text-current',
                open && 'rotate-90',
              )}
              strokeWidth={1.75}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-56 p-1.5 border border-border bg-popover text-popover-foreground rounded-md shadow-overlay select-none z-50"
        >
          {/* Search Box */}
          <div className="flex items-center gap-2 border border-border/70 rounded-md px-2.5 py-1.5 mb-1 bg-background">
            <Search className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-12 text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Project List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredProjects.length === 0 ? (
              <div className="py-4 text-center text-12 text-muted-foreground">
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
                      'flex w-full items-center gap-2 px-2.5 py-1.5 rounded-md text-12 transition-colors cursor-pointer text-left relative before:absolute before:-inset-0.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                      isCurrent
                        ? 'bg-muted font-medium text-foreground'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <ProjectAvatar avatar={p.avatar} name={p.name} id={p.id} size="xs" />
                    <span className="truncate flex-1 text-12 text-foreground">{p.name}</span>
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

      {/* 2. Module Title */}
      <div className="flex items-center gap-2 h-7 px-1 text-13 font-medium text-foreground select-none shrink-0">
        {ModuleIcon && <ModuleIcon className="size-4 text-foreground shrink-0" />}
        <span className="font-medium text-13 tracking-tight text-foreground truncate">
          {moduleTitle}
        </span>
        {typeof count === 'number' && (
          <span className="inline-flex items-center justify-center px-2 py-0.5 min-w-[20px] h-5 rounded-full text-11 font-mono font-medium bg-primary/10 text-primary">
            {count}
          </span>
        )}
      </div>

      {/* 3. Optional Breadcrumb Children (e.g. Cycle context or active view context) */}
      {children}
    </div>
  );
}

export default Switcher;

