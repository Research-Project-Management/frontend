'use client';

import { useEffect, useState, useId } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.services';
import { CreateProjectModal } from '../modals/CreateProjectModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectModuleKey =
  | 'overview'
  | 'pages'
  | 'tasks'
  | 'cycles'
  | 'storage'
  | 'stickies'
  | 'settings';

const MODULE_ORDER: ProjectModuleKey[] = [
  'overview',
  'pages',
  'tasks',
  'cycles',
  'storage',
  'stickies',
  'settings',
];

const modulesConfig: Record<ProjectModuleKey, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: ChartBarBig },
  pages: { label: 'Pages', icon: PenLine },
  tasks: { label: 'Tasks', icon: KanbanSquare },
  cycles: { label: 'Cycles', icon: RotateCcw },
  storage: { label: 'Storage', icon: Cloud },
  stickies: { label: 'Stickies', icon: Layers2 },
  settings: { label: 'Settings', icon: Settings },
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
  const [pinnedArchives, setPinnedArchives] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_pinned_archives') === 'true';
    }
    return false;
  });

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
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);

  const { projects, isLoading } = useProjects(workspaceId);

  // ── Expanded projects (persisted) ──────────────────────────────────────────

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_expanded_projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem('sidebar_expanded_projects', JSON.stringify(Array.from(expandedProjects)));
  }, [expandedProjects]);

  // Auto-expand active project on navigation
  useEffect(() => {
    const active = projects?.find((p) => pathname.includes(`/projects/${p._id}`));
    if (!active) return;
    setExpandedProjects((prev) => (prev.has(active._id) ? prev : new Set(prev).add(active._id)));
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
    pathname === `/${workspaceId}/storage/trash` ||
    pathname.startsWith(`/${workspaceId}/storage/trash`);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-transparent p-2 py-4 select-none">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground">
        <span>Projects</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                aria-label="Toggle sidebar"
                className="rounded-md p-1.5 text-foreground hover:bg-muted/80 cursor-pointer transition-colors outline-none"
              >
                <PanelLeft className="size-4.5 text-foreground" />
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
                className="group relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70"
              >
                {active && (
                  <motion.div
                    layoutId={`sb-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-accent"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className="relative z-10 size-4 shrink-0 text-foreground transition-colors" />
                <span
                  className={`relative z-10 min-w-0 truncate text-sm transition-colors text-foreground ${
                    active
                      ? 'font-semibold'
                      : 'font-medium'
                  }`}
                >
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
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full h-10 px-2.5 rounded-md text-sm font-semibold text-foreground hover:bg-accent/70 transition-colors group cursor-pointer">
              <span>Workspace</span>
              <ChevronDown
                className={cn(
                  "size-4 text-foreground transition-transform duration-200",
                  workspaceSectionOpen ? "" : "-rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden mt-2">
          <div className="flex flex-col gap-1">
            {/* Projects Item -> Navigates to Projects Screen */}
            <Link
              href={`/${workspaceId}/projects`}
              className={`group relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors text-foreground ${
                isProjectsManageActive
                  ? 'bg-accent font-semibold'
                  : 'hover:bg-accent/70 font-medium'
              }`}
            >
              <Briefcase className="size-4 shrink-0 text-foreground transition-colors" />
              <span className="min-w-0 truncate text-sm">Projects</span>
            </Link>

            {/* Pinned Archives */}
            {pinnedArchives && (
              <Link
                href={`/${workspaceId}/storage/trash`}
                className={`group relative flex h-10 items-center justify-between rounded-md px-2.5 text-sm transition-colors text-foreground ${
                  isArchivesActive
                    ? 'bg-accent font-semibold'
                    : 'hover:bg-accent/70 font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="size-4 shrink-0 text-foreground transition-colors" />
                  <span className="min-w-0 truncate text-sm">Archives</span>
                </div>
                <button
                  type="button"
                  onClick={togglePinArchives}
                  title="Unpin from workspace"
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-foreground transition-opacity cursor-pointer"
                >
                  <PinOff className="size-3.5 text-foreground" />
                </button>
              </Link>
            )}

            {/* More / Hide Flyout Popover Menu */}
            <Popover open={isMorePopoverOpen} onOpenChange={setIsMorePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`group flex items-center justify-between w-full h-10 px-2.5 rounded-md text-sm transition-colors cursor-pointer ${
                    isMorePopoverOpen
                      ? 'bg-accent font-semibold text-foreground'
                      : 'text-foreground hover:bg-accent/70 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MoreHorizontal className="size-4 shrink-0 text-foreground transition-colors" />
                    <span className="text-sm">{isMorePopoverOpen ? 'Hide' : 'More'}</span>
                  </div>
                </button>
              </PopoverTrigger>

              <PopoverContent
                side="right"
                align="start"
                sideOffset={8}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-56 p-1.5 shadow-lg border border-border bg-popover rounded-xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/${workspaceId}/storage/trash`}
                    onClick={() => setIsMorePopoverOpen(false)}
                    className={`group flex items-center justify-between h-9 rounded-lg px-2.5 text-sm transition-colors ${
                      isArchivesActive
                        ? 'bg-accent font-semibold text-foreground'
                        : 'hover:bg-accent text-foreground'
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
                      className="p-1 rounded hover:bg-muted/80 text-foreground cursor-pointer transition-colors"
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

      {/* Projects section */}
      <Collapsible
        open={projectsSectionOpen}
        onOpenChange={setProjectsSectionOpen}
        className="mt-4 select-none group/projects-header"
      >
        <div className="flex items-center justify-between h-10 px-2.5 rounded-md text-sm font-semibold text-foreground hover:bg-accent/70 transition-colors">
          <CollapsibleTrigger asChild>
            <button className="flex-1 text-left text-sm font-semibold text-foreground cursor-pointer outline-none">
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
                          "size-7 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-150 outline-none",
                          open ? "opacity-100 bg-black/5 dark:bg-white/5" : "opacity-0 group-hover/projects-header:opacity-100 focus:opacity-100"
                        )}
                      >
                        <Plus className="size-4 text-foreground" />
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
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="sm:max-w-xl bg-popover"
              >
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-foreground">New Project</DialogTitle>
                </DialogHeader>
                <CreateProjectModal onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>

            {/* Collapse / Expand Toggle Button */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                title={projectsSectionOpen ? "Collapse projects" : "Expand projects"}
                className="size-7 flex items-center justify-center rounded-md cursor-pointer text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors outline-none"
              >
                <ChevronDown
                  className={cn(
                    "size-4 text-foreground transition-transform duration-200",
                    projectsSectionOpen ? "" : "-rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Collapsible Project List */}
        <CollapsibleContent className="overflow-hidden mt-1">
          <div className="flex flex-col gap-1">
            {isLoading && (
              <div className="space-y-1 py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 w-full rounded-md bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && (!projects || projects.length === 0) && (
              <p className="px-2.5 py-3 text-xs text-muted-foreground/70">
                No projects found
              </p>
            )}

            {!isLoading &&
              (projects ?? []).map((project) => {
                const isOpen = expandedProjects.has(project._id);
                const projectModules = project.modules ?? [];
                const isProjActive = pathname.includes(`/projects/${project._id}`);

                return (
                  <Collapsible
                    className="w-full group"
                    key={project._id}
                    open={isOpen}
                    onOpenChange={() => toggleProject(project._id)}
                  >
                    <div className="flex h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 transition-colors hover:bg-accent/70">
                      <Link
                        href={`/${workspaceId}/projects/${project._id}/overview`}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium text-foreground transition-colors hover:text-foreground"
                      >
                        <span className="shrink-0 text-base leading-none">{project.avatar}</span>
                        <span
                          className={`min-w-0 truncate ${
                            isProjActive ? 'font-semibold text-foreground' : 'text-foreground'
                          }`}
                        >
                          {project.name}
                        </span>
                      </Link>

                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md p-1 hover:bg-accent cursor-pointer"
                        >
                          <ChevronRight className="size-4 text-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="overflow-hidden">
                      {MODULE_ORDER.filter((k) => projectModules.includes(k)).map((moduleKey) => {
                        const mod = modulesConfig[moduleKey];
                        if (!mod) return null;
                        const link = `/${workspaceId}/projects/${project._id}/${moduleKey}`;
                        const modActive =
                          pathname === link || pathname.startsWith(link + '/');
                        return (
                          <Link
                            href={link}
                            key={moduleKey}
                            className={`group flex h-9 items-center gap-2 rounded-md pl-8 pr-2.5 text-sm transition-colors ${
                              modActive
                                ? 'bg-accent text-foreground font-semibold'
                                : 'text-foreground font-medium hover:bg-accent/70 hover:text-foreground'
                            }`}
                          >
                            <mod.icon className="size-4 shrink-0 text-foreground transition-colors" />
                            <span className="min-w-0 truncate">{mod.label}</span>
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </aside>
  );
}

export default Sidebar;
