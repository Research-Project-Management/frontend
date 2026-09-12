'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Search,
  SlidersHorizontal,
  FileText,
  Settings,
  MoreHorizontal,
  Users,
  LayoutGrid,
  Link2,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  ProjectAvatar,
  WorkItemsIcon,
  CycleIcon,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui';
import { toast } from 'sonner';
import { useProjects, useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
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
  const [moduleOpen, setModuleOpen] = useState(false);
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

  // Modules configured for this project
  const enabledModules: string[] = useMemo(() => {
    const raw = (currentProject as any)?.modules;
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      return ['work-items', 'cycles', 'views', 'pages'];
    }
    const normalized = raw.map((m: string) => (m === 'tasks' ? 'work-items' : m));
    return normalized.filter(
      (m: string) =>
        m !== 'overview' &&
        m !== 'stickies' &&
        m !== 'storage' &&
        m !== 'analytics' &&
        m !== 'settings'
    );
  }, [currentProject]);

  const allModuleNavs = useMemo(() => {
    const basePath = `/projects/${currentProjectId}`;
    return [
      { id: 'work-items', label: 'Work Items', icon: WorkItemsIcon, path: `${basePath}/work-items` },
      { id: 'cycles', label: 'Cycles', icon: CycleIcon, path: `${basePath}/cycles` },
      { id: 'views', label: 'Views', icon: SlidersHorizontal, path: `${basePath}/views` },
      { id: 'pages', label: 'Pages', icon: FileText, path: `${basePath}/pages` },
    ];
  }, [currentProjectId]);

  const visibleModuleNavs = useMemo(() => {
    return allModuleNavs.filter((m) => enabledModules.includes(m.id));
  }, [allModuleNavs, enabledModules]);

  return (
    <div className={cn('flex items-center gap-1 min-w-0 shrink select-none', className)}>
      {/* 1. Project Dropdown Trigger & Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 h-7 px-1.5 -ml-1 rounded-md text-13 font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 select-none',
              open ? 'bg-muted' : 'hover:bg-muted/80',
            )}
          >
            <ProjectAvatar avatar={currentProject.avatar} name={currentProject.name} size="xs" />
            <span className="truncate max-w-[150px] text-13 font-medium text-foreground">
              {displayName}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-56 p-1.5 border border-border bg-popover text-popover-foreground rounded-lg shadow-none"
        >
          {/* Search Box */}
          <div className="flex items-center gap-2 border border-border rounded-md px-2.5 py-1.5 mb-1 bg-background">
            <Search className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Project List */}
          <div className="max-h-52 overflow-y-auto space-y-0.5">
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
                      'flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left',
                      isCurrent
                        ? 'bg-muted font-medium text-foreground'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <ProjectAvatar avatar={p.avatar} name={p.name} size="xs" />
                    <span className="truncate flex-1 text-xs text-foreground">{p.name}</span>
                    {isCurrent && (
                      <Check className="size-3.5 text-foreground shrink-0 ml-auto" strokeWidth={1.5} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Project Actions Menu (Integrated cleanly, no floating 3-dots) */}
          <div className="border-t border-border mt-1.5 pt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${currentProjectId}/settings`);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors cursor-pointer text-foreground text-left"
            >
              <Settings className="size-3.5 text-muted-foreground shrink-0" />
              <span>Project settings</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${currentProjectId}/settings/members`);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors cursor-pointer text-foreground text-left"
            >
              <Users className="size-3.5 text-muted-foreground shrink-0" />
              <span>Members</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/projects/${currentProjectId}/settings/modules`);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors cursor-pointer text-foreground text-left"
            >
              <LayoutGrid className="size-3.5 text-muted-foreground shrink-0" />
              <span>Modules</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(`${window.location.origin}/projects/${currentProjectId}/work-items`);
                  toast.success('Project link copied');
                }
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors cursor-pointer text-foreground text-left"
            >
              <Link2 className="size-3.5 text-muted-foreground shrink-0" />
              <span>Copy project link</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* 2. Breadcrumb Separator */}
      <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 mx-0.5" strokeWidth={1.75} />

      {/* 3. Module Switcher Popover */}
      <Popover open={moduleOpen} onOpenChange={setModuleOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 h-7 px-1.5 rounded-md text-13 font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 select-none',
              moduleOpen ? 'bg-muted' : 'hover:bg-muted/80',
            )}
          >
            {ModuleIcon && <ModuleIcon className="size-4 text-foreground shrink-0" />}
            <span className="font-medium text-13 tracking-tight text-foreground truncate">
              {moduleTitle}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-48 p-1 border border-border bg-popover text-popover-foreground rounded-lg shadow-none text-xs"
        >
          <div className="space-y-0.5">
            {visibleModuleNavs.map((nav) => {
              const NavIcon = nav.icon;
              const isCurrent =
                pathname?.includes(`/${nav.id}`) ||
                (nav.id === 'work-items' && (pathname?.includes('/work-items') || pathname?.includes('/tasks')));
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => {
                    setModuleOpen(false);
                    router.push(nav.path);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left',
                    isCurrent ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-foreground',
                  )}
                >
                  <NavIcon className="size-3.5 shrink-0 text-foreground" />
                  <span className="truncate flex-1">{nav.label}</span>
                  {isCurrent && (
                    <Check className="size-3 text-foreground shrink-0 ml-auto" strokeWidth={1.5} />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* 5. Optional Breadcrumb Children (e.g. Cycle context or active view context) */}
      {children}
    </div>
  );
}

export default Switcher;

