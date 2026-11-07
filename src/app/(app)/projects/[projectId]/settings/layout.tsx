'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  SlidersHorizontal,
  Users,
  CircleDot,
  Tag,
  LayoutGrid,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/shared/lib/utils';
import { prefetchProjectSettingsTab } from '@/features/shell/lib/navigation-prefetch';

const PROJECT_SETTINGS_NAV = [
  {
    key: 'general' as const,
    label: 'General',
    icon: SlidersHorizontal,
    href: '',
  },
  {
    key: 'members' as const,
    label: 'Members',
    icon: Users,
    href: '/members',
  },
  {
    key: 'states' as const,
    label: 'States',
    icon: CircleDot,
    href: '/states',
  },
  {
    key: 'labels' as const,
    label: 'Labels',
    icon: Tag,
    href: '/labels',
  },
  {
    key: 'modules' as const,
    label: 'Modules',
    icon: LayoutGrid,
    href: '/modules',
  },
] as const;

export default function ProjectSettingLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const projectId = params?.projectId || '';
  const basePath = `/projects/${projectId}/settings`;

  const getIsActive = (tabHref: string) => {
    if (tabHref === '') {
      return (
        pathname === basePath ||
        pathname === `${basePath}/` ||
        pathname === `${basePath}/general` ||
        pathname === `${basePath}/general/`
      );
    }
    const fullPath = `${basePath}${tabHref}`;
    return pathname === fullPath || pathname.startsWith(fullPath + '/');
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-background overflow-hidden relative select-none">
      {/* Left Vertical Sidebar matching Personal /settings SideBar */}
      <aside
        aria-label="Project Settings navigation"
        className="h-full w-60 shrink-0 border-r border-border bg-background md:bg-transparent flex flex-col select-none max-md:w-full max-md:h-auto max-md:border-r-0 max-md:border-b"
      >
        <div className="h-11 px-4 flex items-center shrink-0 max-md:hidden">
          <span className="font-semibold text-sm tracking-tight text-foreground">
            Settings
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col p-2.5 overflow-hidden">
          <nav
            aria-label="Project Settings Navigation"
            className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-0.5 pr-1 max-md:flex-row max-md:overflow-x-auto max-md:py-1 max-md:px-1"
          >
            {PROJECT_SETTINGS_NAV.map((item) => {
              const isActive = getIsActive(item.href);
              const targetHref = `${basePath}${item.href}`;
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={targetHref}
                  title={item.label}
                  onMouseEnter={() =>
                    prefetchProjectSettingsTab(queryClient, projectId, item.key)
                  }
                  onFocus={() =>
                    prefetchProjectSettingsTab(queryClient, projectId, item.key)
                  }
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group/item relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 select-none max-md:shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1.5 md:before:hidden',
                    isActive
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                  )}
                >
                  <Icon
                    className="relative z-10 size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                  <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
