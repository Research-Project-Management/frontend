'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/shared/lib/utils';
import { prefetchProjectSettingsTab } from '@/features/shell/lib/navigation-prefetch';

export const SETTINGS_TABS = [
  { key: 'general', label: 'General', href: '' },
  { key: 'members', label: 'Members', href: '/members' },
  { key: 'states', label: 'States', href: '/states' },
  { key: 'labels', label: 'Labels', href: '/labels' },
  { key: 'modules', label: 'Modules', href: '/modules' },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]['key'];

export interface ProjectSettingsNavigationBarProps {
  projectId: string;
  className?: string;
}

export function ProjectSettingsNavigationBar({
  projectId,
  className,
}: ProjectSettingsNavigationBarProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
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
    return pathname.startsWith(fullPath);
  };

  return (
    <nav
      aria-label="Project Settings Navigation"
      className={cn(
        'flex items-center gap-1 border-b border-border px-4 sm:px-6 bg-background select-none shrink-0 h-10 min-h-10 overflow-x-auto scrollbar-none',
        className,
      )}
    >
      {SETTINGS_TABS.map((tab) => {
        const isActive = getIsActive(tab.href);
        const targetHref = `${basePath}${tab.href}`;

        return (
          <Link
            key={tab.key}
            href={targetHref}
            onMouseEnter={() => prefetchProjectSettingsTab(queryClient, projectId, tab.key)}
            onFocus={() => prefetchProjectSettingsTab(queryClient, projectId, tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex h-full items-center gap-2 px-3.5 text-13 font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 before:absolute before:-inset-y-0.5 before:inset-x-0 md:before:hidden',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>

            {isActive && (
              <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default ProjectSettingsNavigationBar;
