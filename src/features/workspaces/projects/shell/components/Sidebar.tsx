'use client';

import { useEffect, useState, useId, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Cloud,
  Home,
  KanbanSquare,
  PanelLeft,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Settings,
  Layers2,
  RotateCcw,
  ChartBarBig,
  UserStar,
  Briefcase,
  MoreHorizontal,
  Archive,
  Star,
  Share2,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { logger } from '@/shared/lib/logger';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useProjects } from '../hooks/use-project';
import { useFavorites } from '../hooks/use-favorites';
import { CreateProjectModal } from './project/CreateProjectModal';
import { BookOpen } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectModuleKey =
  | 'overview'
  | 'pages'
  | 'collection'
  | 'tasks'
  | 'cycles'
  | 'storage'
  | 'stickies';

const MODULE_ORDER: ProjectModuleKey[] = [
  'overview',
  'pages',
  'collection',
  'tasks',
  'cycles',
  'storage',
  'stickies',
];

const modulesConfig: Record<ProjectModuleKey, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: ChartBarBig },
  pages: { label: 'Pages', icon: PenLine },
  collection: { label: 'Collection', icon: BookOpen },
  tasks: { label: 'Work Items', icon: KanbanSquare },
  cycles: { label: 'Cycles', icon: RotateCcw },
  storage: { label: 'Storage', icon: Cloud },
  stickies: { label: 'Stickies', icon: Layers2 },
};

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  exact?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isMorePopoverOpen, setIsMorePopoverOpen] = useState(false);
  const id = useId();

  // Pinned items state (persisted)
  const [pinnedArchives, setPinnedArchives] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);

  const togglePinArchives = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPinnedArchives((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_pinned_archives', String(next));
      return next;
    });
  };

  const navItems: NavItem[] = [
    { label: 'Home', icon: Home, to: `/${workspaceId}`, exact: true },
    { label: 'All pages', icon: PenLine, to: `/${workspaceId}/pages`, exact: false },
    { label: 'Your Work', icon: UserStar, to: `/${workspaceId}/your-work`, exact: false },
    { label: 'Stickies', icon: Layers2, to: `/${workspaceId}/stickies`, exact: false },
  ];

  // Collapsible section open states
  const [workspaceSectionOpen, setWorkspaceSectionOpen] = useState(true);
  const [favoritesSectionOpen, setFavoritesSectionOpen] = useState(true);
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);

  const { projects, isLoading } = useProjects(workspaceId);

  // ── Favorite projects (persisted & synchronized across views) ─────────────
  const { favoriteIds: favoriteProjectIds, toggleFavorite } = useFavorites(workspaceId);

  const favoriteProjects = useMemo(() => {
    if (!projects || favoriteProjectIds.size === 0) return [];
    return projects.filter((p) => favoriteProjectIds.has(p.id));
  }, [projects, favoriteProjectIds]);

  // ── Expanded projects (persisted) ──────────────────────────────────────────

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    setIsMounted(true);
    const savedPin = localStorage.getItem('sidebar_pinned_archives');
    if (savedPin === 'true') {
      setPinnedArchives(true);
    }
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
    const activeId = active.id;
    setExpandedProjects((prev) => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
  }, [pathname, projects]);

  const toggleProject = (projId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projId)) next.delete(projId);
      else next.add(projId);
      return next;
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.to || pathname === item.to + '/';
    return pathname === item.to || pathname.startsWith(item.to + '/');
  };

  const isProjectsManageActive =
    pathname === `/${workspaceId}/projects` ||
    pathname === `/${workspaceId}/projects/`;

  const isArchivesActive =
    pathname === `/${workspaceId}/projects/archives` ||
    pathname.startsWith(`/${workspaceId}/projects/archives`) ||
    pathname === `/${workspaceId}/archives` ||
    pathname.startsWith(`/${workspaceId}/archives`);

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
          className={cn(
            "group/row flex h-8 w-full items-center justify-between gap-1.5 rounded-md px-2.5 transition-colors select-none outline-none",
            isProjActive
              ? "bg-muted text-foreground font-medium"
              : "text-foreground hover:bg-muted font-normal"
          )}
        >
          <Link
            href={`/${workspaceId}/projects/${projId}/overview`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-13 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <span className="shrink-0 text-sm leading-none">{project.avatar || '📁'}</span>
            <span
              className={cn(
                "min-w-0 truncate text-13 tracking-tight text-foreground",
                isProjActive ? "font-medium" : "font-normal"
              )}
            >
              {project.name}
            </span>
          </Link>

          {/* Right Action Icons: 3 Dots Menu & Chevron Toggle (visible on row hover) */}
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
                    href={`/${workspaceId}/projects/${projId}/settings`}
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
                        `${window.location.origin}/${workspaceId}/projects/${projId}/overview`
                      );
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
                    href={`/${workspaceId}/projects/archives`}
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
                    href={`/${workspaceId}/projects/${projId}/settings`}
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
                  "opacity-0 group-hover/row:opacity-100 focus:opacity-100"
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

        <CollapsibleContent className="overflow-hidden flex flex-col gap-1 mt-1">
          {MODULE_ORDER.filter((k) =>
            projectModules.includes(k) || (k === 'collection' && projectModules.includes('references'))
          ).map((moduleKey) => {
            const mod = modulesConfig[moduleKey];
            if (!mod) return null;
            const link = moduleKey === 'tasks'
              ? `/${workspaceId}/projects/${projId}/work-items`
              : `/${workspaceId}/projects/${projId}/${moduleKey}`;
            const modActive =
              pathname === link ||
              pathname.startsWith(link + '/') ||
              (moduleKey === 'tasks' &&
                (pathname === `/${workspaceId}/projects/${projId}/tasks` ||
                  pathname.startsWith(`/${workspaceId}/projects/${projId}/tasks/`)));
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
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-transparent p-2.5 py-4 select-none">
      {/* Header */}
      <div className="mb-3 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground">
        <span>Projects</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                aria-label="Toggle sidebar"
                className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <PanelLeft className="size-4 text-foreground shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              Toggle sidebar
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Nav items */}
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

      {/* Workspace section */}
      <Collapsible
        open={workspaceSectionOpen}
        onOpenChange={setWorkspaceSectionOpen}
        className="mt-4 select-none"
      >
        <div className="group flex items-center justify-between h-8 px-2.5 rounded-md text-13 font-medium text-muted-foreground hover:bg-muted transition-colors duration-200 cursor-pointer">
          <CollapsibleTrigger asChild>
            <button className="flex-1 text-left text-13 font-medium text-inherit cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors duration-200">
              Workspace
            </button>
          </CollapsibleTrigger>

          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    aria-label={workspaceSectionOpen ? "Collapse workspace" : "Expand workspace"}
                    className="size-6 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-sidebar-accent transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 text-inherit transition-transform duration-200",
                        workspaceSectionOpen ? "" : "-rotate-90"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {workspaceSectionOpen ? "Collapse workspace" : "Expand workspace"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <CollapsibleContent className="overflow-hidden mt-1">
          <div className="flex flex-col gap-1">
            {/* Projects Item -> Navigates to Projects Screen */}
            <Link
              href={`/${workspaceId}/projects`}
              className={cn(
                "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none",
                isProjectsManageActive
                  ? "bg-muted text-foreground font-medium"
                  : "text-foreground hover:bg-muted font-normal"
              )}
            >
              <Briefcase className="size-4 shrink-0 text-foreground" />
              <span className="min-w-0 truncate tracking-tight">Projects</span>
            </Link>

            {/* Pinned Archives */}
            {pinnedArchives && (
              <Link
                href={`/${workspaceId}/projects/archives`}
                className={cn(
                  "group relative flex h-8 items-center justify-between rounded-md px-2.5 text-13 leading-5 transition-colors outline-none",
                  isArchivesActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-foreground hover:bg-muted font-normal"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="size-4 shrink-0 text-foreground" />
                  <span className="min-w-0 truncate tracking-tight">Archives</span>
                </div>
                <button
                  type="button"
                  onClick={togglePinArchives}
                  title="Unpin from workspace"
                  className="size-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent text-foreground transition-all cursor-pointer outline-none"
                >
                  <PinOff className="size-3.5 text-foreground shrink-0" />
                </button>
              </Link>
            )}

            {/* More / Hide Flyout Popover Menu */}
            <Popover open={isMorePopoverOpen} onOpenChange={setIsMorePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "group flex items-center justify-between w-full h-8 px-2.5 rounded-md text-13 leading-5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    isMorePopoverOpen
                      ? "bg-muted text-foreground font-medium"
                      : "text-foreground hover:bg-muted font-normal"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <MoreHorizontal className="size-4 shrink-0 text-foreground" />
                    <span className="tracking-tight">{isMorePopoverOpen ? 'Hide' : 'More'}</span>
                  </div>
                </button>
              </PopoverTrigger>

              <PopoverContent
                side="right"
                align="start"
                sideOffset={8}
                onCloseAutoFocus={(e: Event) => e.preventDefault()}
                className="w-56 p-1.5 border border-border bg-popover rounded-md animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/${workspaceId}/projects/archives`}
                    onClick={() => setIsMorePopoverOpen(false)}
                    className={`group flex items-center justify-between h-9 rounded-md px-2.5 text-sm transition-colors ${
                      isArchivesActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Archive className="size-4 text-foreground shrink-0" />
                      <span className="text-sm font-medium">Archives</span>
                    </div>

                    <button
                      type="button"
                      onClick={togglePinArchives}
                      title={pinnedArchives ? 'Unpin from workspace' : 'Pin to workspace'}
                      className="size-6 flex items-center justify-center rounded-md hover:bg-sidebar-accent text-foreground cursor-pointer transition-colors outline-none"
                    >
                      <Pin
                        className={`size-3.5 text-foreground ${
                          pinnedArchives ? 'fill-foreground/20' : ''
                        }`}
                      />
                    </button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Favorites section (placed after Workspace & before Projects; only rendered when user has favorited projects) */}
      {favoriteProjects.length > 0 && (
        <Collapsible
          open={favoritesSectionOpen}
          onOpenChange={setFavoritesSectionOpen}
          className="mt-4 select-none"
        >
          <div className="group flex items-center justify-between h-8 px-2.5 rounded-md text-13 font-medium text-muted-foreground hover:bg-muted transition-colors duration-200 cursor-pointer">
            <CollapsibleTrigger asChild>
              <button className="flex-1 text-left text-13 font-medium text-inherit cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors duration-200">
                Favorites
              </button>
            </CollapsibleTrigger>
            
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={favoritesSectionOpen ? "Collapse favorites" : "Expand favorites"}
                      className="size-6 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-sidebar-accent transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-inherit transition-transform duration-200",
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
            </TooltipProvider>
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
        className="mt-4 select-none"
      >
        <div className="group flex items-center justify-between h-8 px-2.5 rounded-md text-13 font-medium text-muted-foreground hover:bg-muted transition-colors duration-200 cursor-pointer">
          <CollapsibleTrigger asChild>
            <button className="flex-1 text-left text-13 font-medium text-inherit cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors duration-200">
              Projects
            </button>
          </CollapsibleTrigger>

          {/* Right Action Icons: Plus (+), Chevron (v) */}
          <div className="flex items-center gap-0.5">
            {/* New Project Button with Tooltip */}
            <Dialog open={open} onOpenChange={setOpen}>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Create project"
                        className={cn(
                          "size-6 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-sidebar-accent transition-all duration-150 active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                          open
                            ? "opacity-100 bg-sidebar-accent !text-foreground"
                            : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                        )}
                      >
                        <Plus className="size-3.5 text-inherit shrink-0" />
                      </button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                  >
                    Create project
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DialogContent
                onCloseAutoFocus={(e: Event) => e.preventDefault()}
                className="sm:max-w-xl bg-popover"
              >
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-foreground">New Project</DialogTitle>
                </DialogHeader>
                <CreateProjectModal onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>

            {/* Collapse / Expand Toggle Button with Tooltip */}
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={projectsSectionOpen ? "Collapse projects" : "Expand projects"}
                      className="size-6 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-sidebar-accent transition-all duration-150 active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-inherit transition-transform duration-200",
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
            </TooltipProvider>
          </div>
        </div>

        {/* Collapsible Project List */}
        <CollapsibleContent className="overflow-hidden mt-1">
          <div className="flex flex-col gap-1">
            {isLoading && (
              <div className="space-y-1 py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 w-full rounded-md bg-muted animate-pulse" />
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
    </aside>
  );
}

export default Sidebar;
