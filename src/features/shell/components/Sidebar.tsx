'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Microscope,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectsIcon, LibraryIcon, AIIcon, WikiIcon } from '@/shared/components/icons';
import { cn } from '@/shared/lib/utils';
import { useAiCompanionStore } from '@/features/ai/store/ai-companion.store';
import { useWorkspaceContextStore } from '../store/workspace-context.store';
import { prefetchAppSection } from '@/features/shell/lib/navigation-prefetch';
import dynamic from 'next/dynamic';

const StickyDock = dynamic(() => import('./StickyDock'), {
  ssr: false,
  loading: () => <div className="size-8" />,
});

type NavItemId = 'projects' | 'ai' | 'library' | 'labs' | 'pages' | 'settings';

interface ShellNavItem {
  id: NavItemId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  getHref: (projectId: string | null) => string;
}

const CORE_PILLARS: ShellNavItem[] = [
  {
    id: 'projects',
    label: 'Projects',
    icon: ProjectsIcon,
    getHref: () => '/home',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: AIIcon,
    getHref: () => '/ai',
  },
  {
    id: 'library',
    label: 'Library',
    icon: LibraryIcon,
    getHref: () => '/library',
  },
  {
    id: 'labs',
    label: 'Labs',
    icon: Microscope,
    getHref: () => '/experiments',
  },
  {
    id: 'pages',
    label: 'Pages',
    icon: WikiIcon,
    getHref: (projectId) => (projectId ? `/projects/${projectId}/pages` : '/pages'),
  },
];

const SETTINGS_NAV_ITEM: ShellNavItem = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  getHref: (projectId) => (projectId ? `/projects/${projectId}/settings` : '/settings'),
};

const DESKTOP_NAV_ITEMS: ShellNavItem[] = [
  ...CORE_PILLARS,
  SETTINGS_NAV_ITEM,
];

const MOBILE_LEFT_ITEMS = [CORE_PILLARS[0], CORE_PILLARS[2]]; // Projects, Library
const MOBILE_RIGHT_ITEMS = [CORE_PILLARS[3], CORE_PILLARS[4], SETTINGS_NAV_ITEM]; // Labs, Pages, Settings

export default function Sidebar() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const isOpen = useAiCompanionStore((s) => s.isOpen);
  const toggleOpen = useAiCompanionStore((s) => s.toggleOpen);
  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  const activeProjectId =
    activeSpace.type === 'project' ? activeSpace.projectId : null;

  const isNavItemActive = (id: NavItemId): boolean => {
    if (!pathname) return false;

    const isPagesRoute =
      pathname === '/pages' ||
      pathname.startsWith('/pages/') ||
      pathname === '/projects/pages' ||
      /^\/projects\/[^/]+\/pages(\/|$)/.test(pathname);

    const isProjectSettingsRoute = /^\/projects\/[^/]+\/settings(\/|$)/.test(pathname);

    if (id === 'pages') {
      return isPagesRoute;
    }

    if (id === 'projects') {
      if (isPagesRoute || isProjectSettingsRoute) return false;
      return (
        pathname === '/' ||
        pathname === '/home' ||
        pathname.startsWith('/home/') ||
        pathname === '/projects' ||
        pathname.startsWith('/projects/') ||
        pathname === '/drafts' ||
        pathname.startsWith('/drafts/') ||
        pathname === '/your-work' ||
        pathname.startsWith('/your-work/') ||
        pathname === '/stickies' ||
        pathname.startsWith('/stickies/')
      );
    }

    if (id === 'library') {
      return pathname === '/library' || pathname.startsWith('/library/');
    }

    if (id === 'labs') {
      return pathname === '/experiments' || pathname.startsWith('/experiments/');
    }

    if (id === 'ai') {
      return pathname === '/ai' || pathname.startsWith('/ai/');
    }

    if (id === 'settings') {
      return (
        pathname === '/settings' ||
        pathname.startsWith('/settings/') ||
        isProjectSettingsRoute
      );
    }

    return false;
  };

  const renderNavLink = (item: ShellNavItem) => {
    const Icon = item.icon;
    const fullPath = item.getHref(activeProjectId);
    const isActive = isNavItemActive(item.id);

    const handlePrefetch = () => prefetchAppSection(queryClient, item.label);

    return (
      <Link
        key={item.id}
        href={fullPath}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        aria-current={isActive ? 'page' : undefined}
        className="group relative flex flex-1 md:w-full cursor-pointer flex-col items-center justify-center gap-0.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 text-foreground shrink-0 py-0.5"
      >
        <div
          className={cn(
            'relative flex size-7 shrink-0 items-center justify-center rounded-md',
            isActive ? 'bg-sidebar-accent' : 'group-hover:bg-sidebar-hover'
          )}
        >
          <Icon className="relative z-10 size-4.5 text-foreground" />
        </div>

        <span
          className={cn(
            'relative z-10 whitespace-nowrap text-center text-10 md:text-11 tracking-tight leading-none select-none text-foreground',
            isActive ? 'font-medium' : 'font-normal'
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main Navigation"
      className="order-2 relative flex h-14 shrink-0 items-center justify-between bg-transparent px-2 py-1 md:order-1 md:h-full md:w-11 md:flex-col md:justify-between md:rounded-none md:border-t-0 md:border-r-0 md:bg-muted md:p-0 md:py-2 select-none z-30"
    >
      {/* ── Mobile Navigation Bar Background ── */}
      <div className="md:hidden absolute inset-0 pointer-events-none -z-10 bg-muted border-t border-border" />

      {/* ── Mobile Layout (< md): Left 2 items + Elevated Center AI Button + Right items ── */}
      <div className="flex md:hidden items-center justify-around w-full">
        {MOBILE_LEFT_ITEMS.map(renderNavLink)}

        {/* Center Floating AI Chat Button nested in Notch */}
        <div className="flex items-center justify-center px-1 shrink-0">
          <button
            type="button"
            onClick={toggleOpen}
            aria-label="Ask AI Assistant"
            title="Ask AI Assistant"
            className={cn(
              'relative flex size-10 shrink-0 -translate-y-4 items-center justify-center rounded-full bg-background border border-border cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary select-none overflow-hidden z-20',
              isOpen && 'ring-1 ring-primary'
            )}
          >
            <img
              src="/Chat.svg"
              alt="AI Assistant"
              className="size-full object-cover rounded-full block"
            />
          </button>
        </div>

        {MOBILE_RIGHT_ITEMS.map(renderNavLink)}
      </div>

      {/* ── Desktop Layout (>= md): 5 Core Pillars at Top + Settings at Bottom ── */}
      <div className="hidden md:flex flex-col items-center justify-start gap-3 w-full">
        {CORE_PILLARS.map(renderNavLink)}
      </div>

      <div className="hidden md:flex flex-col items-center justify-end gap-2 w-full">
        {renderNavLink(SETTINGS_NAV_ITEM)}
      </div>

      {/* Floating Bottom-Right Speed-Dial (AI Assistant + Chat + Stickies) */}
      <StickyDock mode="floating" />
    </nav>
  );
}
