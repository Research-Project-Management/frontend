'use client';

import { useState, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Home,
  Plus,
  UserStar,
  Compass,
  Archive,
  Briefcase,
  PanelLeft,
  MessageSquare,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import dynamic from 'next/dynamic';
import { cn } from '@/shared/lib/utils';
import {
  AddWorkItemIcon,
  DraftsIcon,
  WorkItemsIcon,
  StickiesIcon,
} from '@/shared/components/icons';
import { useProjectsQuery } from '../hooks/use-project';
import { useQueryClient } from '@tanstack/react-query';
import { useQuickCreate } from '@/features/projects/project-id/work-items/hooks/use-work-item';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import {
  prefetchWorkspaceRoute,
  prefetchProjectSubmodule,
} from '@/features/shell/lib/navigation-prefetch';

const CreateProjectModal = dynamic(
  () =>
    import('./project/CreateProjectModal').then((m) => m.CreateProjectModal),
  { ssr: false }
);
const CreateModal = dynamic(
  () =>
    import('@/features/projects/project-id/work-items/components/modals/CreateModal').then((m) => m.CreateModal),
  { ssr: false }
);

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  exact?: boolean;
  moduleKey?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

function QuickCreateWorkItemDialog({
  open,
  onOpenChange,
  activeProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProjectId: string;
}) {
  const { project, columns, members, isSaving, create } =
    useQuickCreate(activeProjectId);

  return (
    <CreateModal
      open={open}
      onOpenChange={onOpenChange}
      columns={columns}
      members={members}
      project={project}
      onSubmit={async (formData: Record<string, unknown>) => {
        const targetProjId =
          (typeof formData.projectId === 'string' ? formData.projectId : null) ||
          activeProjectId;
        if (!targetProjId) {
          toast.error('Please select or create a project first');
          return;
        }
        const itemTitle =
          typeof formData.title === 'string' ? formData.title.trim() : '';
        if (!itemTitle) {
          toast.error('Work item title is required');
          return;
        }
        await create({
          ...formData,
          title: itemTitle,
          projectId: targetProjId,
        });
      }}
      isSubmitting={isSaving}
    />
  );
}

export function Sidebar({ onToggle }: { onToggle?: () => void }) {
  const queryClient = useQueryClient();
  const params = useParams<{ projectId?: string }>();
  const pathname = usePathname();

  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  // Modals state
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [isCreateWorkItemOpen, setIsCreateWorkItemOpen] = useState(false);
  const [directorySectionOpen, setDirectorySectionOpen] = useState(true);

  const { projects = [] } = useProjectsQuery();

  const isProjectMode =
    activeSpace.type === 'project' && Boolean(activeSpace.projectId || params?.projectId);

  const resolvedProjectId =
    params?.projectId ||
    (activeSpace.type === 'project' ? activeSpace.projectId : null) ||
    (projects && projects.length > 0 ? projects[0]?.id : '') ||
    '';

  const currentProject = useMemo(() => {
    if (!resolvedProjectId) return null;
    return projects.find((p) => p.id === resolvedProjectId) || null;
  }, [projects, resolvedProjectId]);

  // ── 1. Personal Space (Private) Navigation ─────────────────────────────────
  const personalNavItems: NavItem[] = useMemo(
    () => [
      { label: 'Home', icon: Home, to: '/home', exact: true },
      { label: 'Your work', icon: UserStar, to: '/your-work', exact: false },
      { label: 'Drafts', icon: DraftsIcon, to: '/drafts', exact: false },
      { label: 'Stickies', icon: StickiesIcon, to: '/stickies', exact: false },
    ],
    []
  );

  const directoryItems = useMemo(
    () => [
      {
        id: 'all-projects',
        label: 'All projects',
        icon: Briefcase,
        to: '/projects',
      },
      {
        id: 'archives',
        label: 'Archives',
        icon: Archive,
        to: '/projects/archives',
      },
    ],
    []
  );

  // ── 2. Project Space Navigation ────────────────────────────────────────────
  const projectNavItems: NavItem[] = useMemo(() => {
    if (!resolvedProjectId) return [];
    return [
      { label: 'Home', icon: Home, to: '/home', exact: true },
      { label: 'Your work', icon: UserStar, to: '/your-work', exact: false },
      { label: 'Drafts', icon: DraftsIcon, to: '/drafts', exact: false },
      { label: 'Stickies', icon: StickiesIcon, to: '/stickies', exact: false },
    ];
  }, [resolvedProjectId]);

  const projectModuleItems: NavItem[] = useMemo(() => {
    if (!resolvedProjectId) return [];
    return [
      {
        label: 'Overview',
        icon: Compass,
        to: `/projects/${resolvedProjectId}/overview`,
        moduleKey: 'overview',
      },
      {
        label: 'Work items',
        icon: WorkItemsIcon,
        to: `/projects/${resolvedProjectId}/work-items`,
        moduleKey: 'work-items',
      },
      {
        label: 'Messages',
        icon: MessageSquare,
        to: `/projects/${resolvedProjectId}/messages`,
        moduleKey: 'messages',
      },
      {
        label: 'Budget',
        icon: Wallet,
        to: `/projects/${resolvedProjectId}/budget`,
        moduleKey: 'budget',
      },
    ];
  }, [resolvedProjectId]);

  // ── Navigation Helpers ─────────────────────────────────────────────────────
  const isItemActive = (item: NavItem) => {
    if (item.moduleKey === 'work-items') {
      return (
        pathname === item.to ||
        pathname.startsWith(item.to + '/') ||
        pathname === `/projects/${resolvedProjectId}` ||
        pathname === `/projects/${resolvedProjectId}/`
      );
    }
    if (item.exact) return pathname === item.to || pathname === item.to + '/';
    return pathname === item.to || pathname.startsWith(item.to + '/');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="flex flex-col h-full w-full shrink-0 overflow-hidden bg-transparent p-2 py-3 select-none">
      {/* Header */}
      <div className="mb-2 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground shrink-0">
        <span className="text-14 font-semibold text-foreground truncate">
          {isProjectMode
            ? currentProject?.name || activeSpace.projectName || 'Project'
            : 'Projects'}
        </span>
        <button
          type="button"
          onClick={() => {
            if (onToggle) {
              onToggle();
            } else {
              window.dispatchEvent(new CustomEvent('toggle-project-sidebar'));
            }
          }}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
        >
          <PanelLeft className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Quick Action: New Work Item */}
      <div className="mb-2 shrink-0">
        <button
          type="button"
          onMouseEnter={() =>
            resolvedProjectId &&
            prefetchProjectSubmodule(queryClient, resolvedProjectId, 'work-items')
          }
          onFocus={() =>
            resolvedProjectId &&
            prefetchProjectSubmodule(queryClient, resolvedProjectId, 'work-items')
          }
          onClick={() => setIsCreateWorkItemOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background hover:bg-muted px-2.5 text-13 font-medium text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <AddWorkItemIcon className="size-4 shrink-0 text-foreground" />
          <span className="tracking-tight">New work item</span>
        </button>
      </div>

      {/* Scrollable Navigation Content */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scrollbar flex flex-col gap-3">
        {isProjectMode ? (
          /* ── PROJECT SPACE VIEW ── */
          <>
            <div className="shrink-0">
              <nav className="flex flex-col gap-1" aria-label="Workspace navigation">
                {projectNavItems.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <Link
                      href={item.to}
                      key={item.label}
                      onMouseEnter={() => prefetchWorkspaceRoute(queryClient, item.to)}
                      onFocus={() => prefetchWorkspaceRoute(queryClient, item.to)}
                      className={cn(
                        'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none',
                        active
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground hover:bg-muted font-normal'
                      )}
                    >
                      <item.icon className="relative z-10 size-4 shrink-0 text-foreground" />
                      <span className="relative z-10 min-w-0 truncate tracking-tight">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="shrink-0">
              <div className="flex items-center justify-between h-7 px-2.5 text-11 font-medium text-muted-foreground select-none">
                <span>Project</span>
              </div>
              <nav className="flex flex-col gap-1 mt-1" aria-label="Project modules">
                {projectModuleItems.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <Link
                      href={item.to}
                      key={item.label}
                      onMouseEnter={() => {
                        if (item.moduleKey && resolvedProjectId) {
                          prefetchProjectSubmodule(queryClient, resolvedProjectId, item.moduleKey);
                        } else {
                          prefetchWorkspaceRoute(queryClient, item.to);
                        }
                      }}
                      onFocus={() => {
                        if (item.moduleKey && resolvedProjectId) {
                          prefetchProjectSubmodule(queryClient, resolvedProjectId, item.moduleKey);
                        } else {
                          prefetchWorkspaceRoute(queryClient, item.to);
                        }
                      }}
                      className={cn(
                        'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none',
                        active
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground hover:bg-muted font-normal'
                      )}
                    >
                      <item.icon className="relative z-10 size-4 shrink-0 text-foreground" />
                      <span className="relative z-10 min-w-0 truncate tracking-tight">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>
        ) : (
          /* ── PERSONAL SPACE (PRIVATE) VIEW ── */
          <>
            <div className="shrink-0">
              <nav className="flex flex-col gap-1" aria-label="Personal navigation">
                {personalNavItems.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <Link
                      href={item.to}
                      key={item.label}
                      onMouseEnter={() => prefetchWorkspaceRoute(queryClient, item.to)}
                      onFocus={() => prefetchWorkspaceRoute(queryClient, item.to)}
                      className={cn(
                        'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none',
                        active
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground hover:bg-muted font-normal'
                      )}
                    >
                      <item.icon className="relative z-10 size-4 shrink-0 text-foreground" />
                      <span className="relative z-10 min-w-0 truncate tracking-tight">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Directory section for managing Projects & Archives */}
            <Collapsible
              open={directorySectionOpen}
              onOpenChange={setDirectorySectionOpen}
              className="select-none"
            >
              <div className="group/proj-header flex items-center justify-between h-7 px-2.5 text-11 font-medium text-muted-foreground select-none">
                <CollapsibleTrigger asChild>
                  <button className="flex-1 text-left text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer outline-none">
                    Directory
                  </button>
                </CollapsibleTrigger>

                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Create project"
                        onClick={() => setCreateProjectOpen(true)}
                        className={cn(
                          'size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted outline-none',
                          createProjectOpen
                            ? 'bg-muted text-foreground'
                            : 'opacity-0 group-hover/proj-header:opacity-100 focus:opacity-100'
                        )}
                      >
                        <Plus className="size-3 text-inherit shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      Create project
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          aria-label={directorySectionOpen ? 'Collapse directory' : 'Expand directory'}
                          className="size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted outline-none"
                        >
                          <ChevronDown
                            className={cn(
                              'size-3 text-inherit transition-transform duration-150',
                              directorySectionOpen ? '' : '-rotate-90'
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {directorySectionOpen ? 'Collapse directory' : 'Expand directory'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <CollapsibleContent className="overflow-hidden mt-1">
                <div className="flex flex-col gap-1">
                  {directoryItems.map((item) => {
                    const ItemIcon = item.icon;
                    const active =
                      item.to === '/projects'
                        ? pathname === '/projects' || pathname === '/projects/'
                        : pathname === item.to || pathname.startsWith(item.to + '/');

                    return (
                      <Link
                        key={item.id}
                        href={item.to}
                        onMouseEnter={() => prefetchWorkspaceRoute(queryClient, item.to)}
                        onFocus={() => prefetchWorkspaceRoute(queryClient, item.to)}
                        className={cn(
                          'group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none',
                          active
                            ? 'bg-muted text-foreground font-medium'
                            : 'text-foreground hover:bg-muted font-normal'
                        )}
                      >
                        <ItemIcon className="size-4 shrink-0 text-foreground" />
                        <span className="min-w-0 truncate tracking-tight">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>

      {/* Modals */}
      {createProjectOpen && (
        <CreateProjectModal
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
          onSuccess={() => setCreateProjectOpen(false)}
        />
      )}

      {isCreateWorkItemOpen && (
        <QuickCreateWorkItemDialog
          open={isCreateWorkItemOpen}
          onOpenChange={setIsCreateWorkItemOpen}
          activeProjectId={resolvedProjectId}
        />
      )}
    </aside>
  );
}

export default Sidebar;
