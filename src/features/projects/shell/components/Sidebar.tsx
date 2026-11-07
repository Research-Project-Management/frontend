'use client';

import { useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  UserStar,
  Compass,
  PanelLeft,
  MessageSquare,
  Wallet,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import {
  DraftsIcon,
  WorkItemsIcon,
  StickiesIcon,
} from '@/shared/components/icons';
import { useProjectsQuery } from '../hooks/use-project';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import {
  prefetchWorkspaceRoute,
  prefetchProjectSubmodule,
} from '@/features/shell/lib/navigation-prefetch';

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  exact?: boolean;
  moduleKey?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ onToggle }: { onToggle?: () => void }) {
  const queryClient = useQueryClient();
  const params = useParams<{ projectId?: string }>();
  const pathname = usePathname();

  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  const { projects = [] } = useProjectsQuery();

  const isProjectRoute =
    Boolean(params?.projectId && params.projectId !== 'personal') ||
    Boolean(
      pathname?.startsWith('/projects/') &&
        pathname !== '/projects' &&
        !pathname.startsWith('/projects/archives')
    );

  const isProjectMode =
    isProjectRoute &&
    activeSpace.type === 'project' &&
    Boolean(activeSpace.projectId || params?.projectId);

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

  // ── 2. Project Space Navigation (100% Project-Scoped) ──────────────────────
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
    <aside className="flex flex-col h-full w-full shrink-0 overflow-hidden bg-transparent select-none">
      {/* Topbar Header matching Library, Labs & Settings h-11 */}
      <div className="h-11 px-2.5 flex items-center shrink-0">
        <div className="flex items-center justify-between h-8 px-1 font-semibold text-sm tracking-tight text-foreground select-none w-full">
          <span className="shrink-0 font-semibold text-15 tracking-tight text-foreground truncate max-w-[180px]">
            {isProjectMode
              ? currentProject?.name || activeSpace.projectName || 'Project'
              : 'Projects'}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
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
                className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
              >
                <PanelLeft className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
              Collapse sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Scrollable Navigation Content */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scrollbar flex flex-col gap-3 p-2.5 pt-2.5 pb-1">
        {isProjectMode ? (
          /* ── PROJECT SPACE VIEW (100% Project-Scoped) ── */
          <div className="shrink-0">
            <nav className="flex flex-col gap-0.5" aria-label="Project modules">
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
        ) : (
          /* ── PERSONAL SPACE (PRIVATE) VIEW ── */
          <div className="shrink-0">
            <nav className="flex flex-col gap-0.5" aria-label="Personal navigation">
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
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
