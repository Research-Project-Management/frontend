'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

export const TABS = [
  { key: 'summary', label: 'Summary', href: '' },
  { key: 'assigned', label: 'Assigned', href: '/assigned' },
  { key: 'created', label: 'Created', href: '/created' },
  { key: 'subscribed', label: 'Subscribed', href: '/subscribed' },
  { key: 'activity', label: 'Activity', href: '/activity' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export interface NavigationBarProps {
  counts?: Partial<Record<TabKey, number>>;
  className?: string;
}

export default function NavigationBar({
  counts = {},
  className,
}: NavigationBarProps) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const pathname = usePathname();

  const basePath = `/${workspaceId}/your-work`;

  const getIsActive = (tabHref: string) => {
    const fullPath = `${basePath}${tabHref}`;
    if (tabHref === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(fullPath);
  };

  return (
    <nav
      className={cn(
        'flex items-center gap-1 border-b border-border px-6 bg-background select-none shrink-0',
        className
      )}
    >
      {TABS.map((tab) => {
        const isActive = getIsActive(tab.href);
        const count = counts[tab.key];
        const targetHref = `${basePath}${tab.href}`;

        return (
          <Link
            key={tab.key}
            href={targetHref}
            className={cn(
              'relative flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium transition-colors outline-none',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{tab.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-semibold',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            )}

            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
