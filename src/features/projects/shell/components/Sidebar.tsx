'use client';

import { useEffect, useState, useId, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Home,
  Plus,
  Settings,
  UserStar,
  MoreHorizontal,
  Compass,
  Archive,
  Star,
  Share2,
  Link2,
  FileText,
  Briefcase,
  Layers,
  BarChart3,
  Pin,
  PinOff,
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  ProjectAvatar,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  AddWorkItemIcon,
  DraftsIcon,
  WorkItemsIcon,
  CycleIcon,
  StickiesIcon,
} from '@/shared/components/icons';
import { useProjects } from '../hooks/use-project';
import { useFavorites } from '../hooks/use-favorites';
import { useProject } from '@/features/projects/project-id/work-items/hooks/use-work-item';
import { CreateProjectModal } from '@/features/projects/shell/components/project/CreateProjectModal';
import { CreateModal } from '@/features/projects/project-id/work-items/components/modals/CreateModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectModuleKey = 'overview' | 'work-items' | 'views' | 'pages' | 'cycles';

const MODULE_ORDER: ProjectModuleKey[] = [
  'overview',
  'work-items',
  'views',
  'pages',
  'cycles',
];

const modulesConfig: Record<ProjectModuleKey, { label: string; icon: React.ComponentType<any>; path: string }> = {
  'overview':   { label: 'Overview',   icon: Compass,          path: 'overview' },
  'work-items': { label: 'Work items', icon: WorkItemsIcon,    path: 'work-items' },
  'views':      { label: 'Views',      icon: Layers,           path: 'views' },
  'pages':      { label: 'Pages',      icon: FileText,         path: 'pages' },
  'cycles':     { label: 'Cycles',     icon: CycleIcon,        path: 'cycles' },
};

type NavItem = {
  label: string;
  icon: React.ComponentType<any>;
  to: string;
  exact?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ onToggle }: { onToggle?: () => void }) {
  const params = useParams<{ projectId?: string }>();
  const pathname = usePathname();
  const id = useId();

  // Modals state
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [isCreateWorkItemOpen, setIsCreateWorkItemOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const { projects = [], isLoading } = useProjects();

  // Active project context for quick work item creation
  const activeProjectId = params?.projectId || (projects && projects.length > 0 ? projects[0]?.id : '');
  const { state: activeProjectState, actions: activeProjectActions } = useProject({
    projectId: activeProjectId || '',
  });

  // Main navigation items: strictly (home, drafts, your work, stickies)
  const navItems: NavItem[] = [
    { label: 'Home', icon: Home, to: '/home', exact: true },
    { label: 'Drafts', icon: DraftsIcon, to: '/drafts', exact: false },
    { label: 'Your work', icon: UserStar, to: '/your-work', exact: false },
    { label: 'Stickies', icon: StickiesIcon, to: '/stickies', exact: false },
  ];

  // Collapsible section open states
  const [overviewSectionOpen, setOverviewSectionOpen] = useState(true);
  const [favoritesSectionOpen, setFavoritesSectionOpen] = useState(true);
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);

  // Hidden items in Overview section (persisted)
  const [hiddenOverviewItems, setHiddenOverviewItems] = useState<Set<string>>(() => new Set<string>());
  const [isHidePopoverOpen, setIsHidePopoverOpen] = useState(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem('sidebar_hidden_overview_items') ||
        localStorage.getItem('sidebar_hidden_workspace_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHiddenOverviewItems(new Set(parsed.filter((item): item is string => typeof item === 'string')));
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleHideOverviewItem = (itemId: string) => {
    setHiddenOverviewItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      try {
        localStorage.setItem('sidebar_hidden_overview_items', JSON.stringify(Array.from(next)));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const overviewItems = useMemo(
    () => [
      {
        id: 'projects',
        label: 'Projects',
        icon: Briefcase,
        to: '/projects',
        canHide: false,
      },
      {
        id: 'views',
        label: 'Views',
        icon: Layers,
        to: '/projects/views',
        canHide: true,
      },
      {
        id: 'cycles',
        label: 'Cycles',
        icon: CycleIcon,
        to: '/projects/cycles',
        canHide: true,
      },
      {
        id: 'pages',
        label: 'Pages',
        icon: FileText,
        to: '/projects/pages',
        canHide: true,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        to: '/projects/analytics',
        canHide: true,
      },
      {
        id: 'archives',
        label: 'Archives',
        icon: Archive,
        to: '/projects/archives',
        canHide: true,
      },
    ],
    []
  );

  // ── Favorite projects (persisted & synchronized across views) ─────────────
  const { favoriteIds: favoriteProjectIds, toggleFavorite } = useFavorites();

  const favoriteProjects = useMemo(() => {
    if (!projects || favoriteProjectIds.size === 0) return [];
    return projects.filter((p) => favoriteProjectIds.has(p.id));
  }, [projects, favoriteProjectIds]);

  // ── Expanded projects (persisted) ──────────────────────────────────────────
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('sidebar_expanded_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setExpandedProjects(new Set<string>(parsed.filter((item): item is string => typeof item === 'string')));
        }
      } catch (err) {
        logger.debug('[Sidebar] Failed to parse expanded projects', { err });
      }
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('sidebar_expanded_projects', JSON.stringify(Array.from(expandedProjects)));
  }, [expandedProjects, isMounted]);

  // Auto-expand active project on navigation
  useEffect(() => {
    const active = projects?.find((p) => pathname.includes(`/projects/${p.id}`));
    if (!active) return;
    const currentActiveId = active.id;
    setExpandedProjects((prev) => (prev.has(currentActiveId) ? prev : new Set(prev).add(currentActiveId)));
  }, [pathname, projects]);

  const toggleProject = (projId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projId)) next.delete(projId);
      else next.add(projId);
      return next;
    });
  };

  // ── Navigation Helpers ─────────────────────────────────────────────────────
  const isActive = (item: NavItem) => {
    if (item.to === '/home' && (pathname === '/home' || pathname === '/home/' || pathname === '/dashboard' || pathname === '/dashboard/')) {
      return true;
    }
    if (item.exact) return pathname === item.to || pathname === item.to + '/';
    return pathname === item.to || pathname.startsWith(item.to + '/');
  };

  // ── Project Item Renderer ──────────────────────────────────────────────────
  const renderProjectItem = (project: any, keyPrefix = '') => {
    const projId = project.id || '';
    const isOpen = expandedProjects.has(projId);
    const projectModules = project.modules ?? [];
    const isProjActive = pathname.includes(`/projects/${projId}`);
    const isFavorited = favoriteProjectIds.has(projId);

    return (
      <Collapsible
        className="w-full group/project-row"
        key={`${keyPrefix}${projId}`}
        open={isOpen}
        onOpenChange={() => toggleProject(projId)}
      >
        <div
          className="group/row flex h-8 w-full items-center justify-between gap-1.5 rounded-md px-2.5 transition-colors select-none outline-none text-foreground hover:bg-muted font-normal"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-13 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ProjectAvatar avatar={project.avatar} name={project.name} id={projId} size="xs" />
              <span className="min-w-0 truncate text-13 tracking-tight text-foreground font-medium">
                {project.name}
              </span>
            </button>
          </CollapsibleTrigger>

          {/* Right Action Icons: 3 Dots Menu & Chevron Toggle */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* 3-dots dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Project options"
                  className={cn(
                    "size-6 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-sidebar-accent transition-all duration-150 active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    "opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-sidebar-accent focus:opacity-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-3.5 text-inherit shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={8}
                className="w-52 p-1.5 border border-border bg-popover rounded-md animate-in fade-in zoom-in-95 duration-150 z-50"
              >
                {/* 1. Add to favorites / Remove from favorites */}
                <DropdownMenuItem
                  onClick={(e) => toggleFavorite(projId, e)}
                  className="cursor-pointer text-sm font-medium flex items-center gap-2.5 px-2.5 py-2 rounded-md"
                >
                  <Star
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isFavorited
                        ? "fill-warning text-warning"
                        : "text-foreground"
                    )}
                  />
                  <span>
                    {isFavorited
                      ? "Remove from favorites"
                      : "Add to favorites"}
                  </span>
                </DropdownMenuItem>

                {/* 2. Publish project */}
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer text-sm font-medium px-2.5 py-2 rounded-md"
                >
                  <Link
                    href={`/projects/${projId}/settings`}
                    className="flex items-center gap-2.5 w-full"
                  >
                    <Share2 className="size-4 text-foreground shrink-0" />
                    <span>Publish project</span>
                  </Link>
                </DropdownMenuItem>

                {/* 3. Copy link */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/projects/${projId}`
                      );
                      toast.success('Project link copied');
                    }
                  }}
                  className="cursor-pointer text-sm font-medium flex items-center gap-2.5 px-2.5 py-2 rounded-md"
                >
                  <Link2 className="size-4 text-foreground shrink-0" />
                  <span>Copy link</span>
                </DropdownMenuItem>

                {/* 4. Archives */}
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer text-sm font-medium px-2.5 py-2 rounded-md"
                >
                  <Link
                    href={`/projects/archives`}
                    className="flex items-center gap-2.5 w-full"
                  >
                    <Archive className="size-4 text-foreground shrink-0" />
                    <span>Archives</span>
                  </Link>
                </DropdownMenuItem>

                {/* 5. Settings */}
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer text-sm font-medium px-2.5 py-2 rounded-md"
                >
                  <Link
                    href={`/projects/${projId}/settings`}
                    className="flex items-center gap-2.5 w-full"
                  >
                    <Settings className="size-4 text-foreground shrink-0" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Chevron collapse / expand toggle button */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label={isOpen ? "Collapse project" : "Expand project"}
                className={cn(
                  "size-6 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-sidebar-accent transition-all duration-150 active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  isOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                )}
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 text-inherit transition-transform duration-200",
                    isOpen ? "" : "-rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Project Submodules: strictly work-items, views, pages, cycles */}
        <CollapsibleContent className="overflow-hidden flex flex-col gap-1 mt-1">
          {(() => {
            const rawModules: string[] =
              projectModules && projectModules.length > 0
                ? projectModules.map((m: string) => String(m).toLowerCase().replace(/_/g, '-'))
                : ['work-items', 'views', 'pages', 'cycles'];
            const activeSet = new Set(rawModules);

            // Strictly filter by MODULE_ORDER, ensuring overview and work-items are always present as core navigation
            const effectiveModules = MODULE_ORDER.filter(
              (k) =>
                k === 'overview' ||
                k === 'work-items' ||
                !projectModules ||
                projectModules.length === 0 ||
                activeSet.has(k) ||
                activeSet.has(k.replace(/-/g, '_'))
            );
            const displayModules = effectiveModules.length > 0 ? effectiveModules : MODULE_ORDER;

            return displayModules.map((moduleKey) => {
              const mod = modulesConfig[moduleKey];
              if (!mod) return null;
              const link = `/projects/${projId}/${mod.path}`;
              const modActive =
                pathname === link ||
                pathname.startsWith(link + '/') ||
                (moduleKey === 'work-items' &&
                  (pathname === `/projects/${projId}` ||
                    pathname === `/projects/${projId}/`));
              return (
                <Link
                  href={link}
                  key={moduleKey}
                  className={cn(
                    "group flex h-8 items-center gap-2 rounded-md pl-6 pr-2.5 text-13 leading-5 transition-colors outline-none",
                    modActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-foreground font-normal hover:bg-muted"
                  )}
                >
                  <mod.icon className="size-3.5 shrink-0 text-foreground" />
                  <span className="min-w-0 truncate tracking-tight">{mod.label}</span>
                </Link>
              );
            });
          })()}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="flex flex-col h-full w-60 shrink-0 overflow-hidden border-r border-border bg-background p-2 py-3 select-none">
      {/* Header */}
      <div className="mb-2 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground shrink-0">
        <span className="text-14 font-semibold text-foreground">Projects</span>
      </div>

      {/* Quick Action: New Work Item */}
      <div className="mb-2 shrink-0">
        <button
          type="button"
          onClick={() => setIsCreateWorkItemOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-13 font-medium text-foreground cursor-pointer shadow-2xs outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <AddWorkItemIcon className="size-4 shrink-0 text-foreground" />
          <span className="tracking-tight">New work item</span>
        </button>
      </div>

      {/* Scrollable Section: All Navigation below New Work Item */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scrollbar flex flex-col gap-2">
        {/* Nav items: strictly (home, drafts, your work, sticky) */}
        <div className="shrink-0">
          <LayoutGroup id={`sb-nav-${id}`}>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    href={item.to}
                    key={item.label}
                    className={cn(
                      "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none",
                      active
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted font-normal"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId={`sb-nav-active-${id}`}
                        className="absolute inset-0 rounded-md bg-muted"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <item.icon
                      className="relative z-10 size-4 shrink-0 text-foreground"
                    />
                    <span className="relative z-10 min-w-0 truncate tracking-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </LayoutGroup>
        </div>

        {/* Overview section */}
        <Collapsible
          open={overviewSectionOpen}
          onOpenChange={setOverviewSectionOpen}
          className="select-none"
        >
          <div className="flex items-center justify-between h-7 px-2.5 text-11 font-medium text-muted-foreground select-none">
            <CollapsibleTrigger asChild>
              <button className="flex-1 text-left text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer outline-none transition-colors">
                Overview
              </button>
            </CollapsibleTrigger>

            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    aria-label={overviewSectionOpen ? "Collapse overview" : "Expand overview"}
                    className="size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3 text-inherit transition-transform duration-200",
                        overviewSectionOpen ? "" : "-rotate-90"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {overviewSectionOpen ? "Collapse overview" : "Expand overview"}
              </TooltipContent>
            </Tooltip>
          </div>

          <CollapsibleContent className="overflow-hidden mt-1">
            <div className="flex flex-col gap-1">
              {overviewItems
                .filter((item) => !hiddenOverviewItems.has(item.id))
                .map((item) => {
                  const ItemIcon = item.icon;
                  const active =
                    item.to === '/projects'
                      ? pathname === '/projects' || pathname === '/projects/'
                      : pathname === item.to || pathname.startsWith(item.to + '/');

                  return (
                    <Link
                      key={item.id}
                      href={item.to}
                      className={cn(
                        "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none",
                        active
                          ? "bg-muted text-foreground font-medium"
                          : "text-foreground hover:bg-muted font-normal"
                      )}
                    >
                      <ItemIcon className="size-4 shrink-0 text-foreground" />
                      <span className="min-w-0 truncate tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}

              {/* Hide / Customize Trigger */}
              <Popover open={isHidePopoverOpen} onOpenChange={setIsHidePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none cursor-pointer"
                  >
                    <MoreHorizontal className="size-4 shrink-0" />
                    <span className="min-w-0 truncate tracking-tight">Hide</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="w-56 p-1.5 border border-border bg-popover text-popover-foreground rounded-lg shadow-raised-200 z-50 text-xs"
                >
                  <div className="space-y-0.5">
                    {overviewItems
                      .filter((item) => item.canHide)
                      .map((item) => {
                        const ItemIcon = item.icon;
                        const isHidden = hiddenOverviewItems.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleHideOverviewItem(item.id)}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer text-left text-13 group"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <ItemIcon className="size-4 shrink-0 text-foreground" />
                              <span className="truncate">{item.label}</span>
                            </div>
                            {isHidden ? (
                              <Pin
                                className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-foreground transition-colors"
                              />
                            ) : (
                              <PinOff
                                className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                              />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CollapsibleContent>
        </Collapsible>
        {/* Favorites section (only rendered when user has favorited projects) */}
        {favoriteProjects.length > 0 && (
          <Collapsible
            open={favoritesSectionOpen}
            onOpenChange={setFavoritesSectionOpen}
            className="select-none"
          >
            <div className="flex items-center justify-between h-7 px-2.5 text-11 font-medium text-muted-foreground select-none">
              <Link
                href="/projects/favorite"
                className="flex-1 text-left text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer outline-none transition-colors"
              >
                Favorites
              </Link>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={favoritesSectionOpen ? "Collapse favorites" : "Expand favorites"}
                      className="size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3 text-inherit transition-transform duration-200",
                          favoritesSectionOpen ? "" : "-rotate-90"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  {favoritesSectionOpen ? "Collapse favorites" : "Expand favorites"}
                </TooltipContent>
              </Tooltip>
            </div>

            <CollapsibleContent className="overflow-hidden mt-1">
              <div className="flex flex-col gap-1">
                {favoriteProjects.map((project) => renderProjectItem(project, 'fav-'))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Projects section */}
        <Collapsible
          open={projectsSectionOpen}
          onOpenChange={setProjectsSectionOpen}
          className="select-none"
        >
          <div className="group/proj-header flex items-center justify-between h-7 px-2.5 text-11 font-medium text-muted-foreground select-none">
            <CollapsibleTrigger asChild>
              <button className="flex-1 text-left text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer outline-none transition-colors">
                Projects
              </button>
            </CollapsibleTrigger>

            {/* Right Action Icons: Plus (+), Chevron (v) */}
            <div className="flex items-center gap-0.5">
              {/* New Project Button with Tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Create project"
                    onClick={() => setCreateProjectOpen(true)}
                    className={cn(
                      "size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none",
                      createProjectOpen
                        ? "bg-muted text-foreground"
                        : "opacity-0 group-hover/proj-header:opacity-100 focus:opacity-100"
                    )}
                  >
                    <Plus className="size-3 text-inherit shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Create project
                </TooltipContent>
              </Tooltip>

              {/* Collapse / Expand Toggle Button with Tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={projectsSectionOpen ? "Collapse projects" : "Expand projects"}
                      className="size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3 text-inherit transition-transform duration-200",
                          projectsSectionOpen ? "" : "-rotate-90"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  {projectsSectionOpen ? "Collapse projects" : "Expand projects"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Collapsible Project List */}
          <CollapsibleContent className="overflow-hidden mt-1">
            <div className="flex flex-col gap-1">
              {isLoading && (
                <div className="space-y-1 py-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 w-full rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoading && (!projects || projects.length === 0) && (
                <p className="px-2.5 py-3 text-xs text-muted-foreground">
                  No projects found
                </p>
              )}

              {!isLoading &&
                (projects ?? []).map((project) => renderProjectItem(project))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Modals */}
      <CreateProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onSuccess={() => setCreateProjectOpen(false)}
      />

      {isCreateWorkItemOpen && (
        <CreateModal
          open={isCreateWorkItemOpen}
          onOpenChange={setIsCreateWorkItemOpen}
          columns={activeProjectState.columns}
          members={activeProjectState.members}
          project={activeProjectState.project}
          cycles={activeProjectState.cycles}
          onSubmit={async (formData: any) => {
            const targetProjId = (formData as any).projectId || activeProjectId;
            if (!targetProjId) {
              toast.error('Please select or create a project first');
              return;
            }
            const itemTitle = formData.title?.trim();
            if (!itemTitle) {
              toast.error('Work item title is required');
              return;
            }
            await (activeProjectActions.createWorkItem || activeProjectActions.create)({
              ...formData,
              title: itemTitle,
              projectId: targetProjId,
            });
          }}
          isSubmitting={activeProjectState.isSaving}
        />
      )}
    </aside>
  );
}

export default Sidebar;
