'use client';

/**
 * features/shell/components/inbox/InboxTabs.tsx
 * Tab Switcher for Inbox: All, Project, Pages (Manuscripts / Editor).
 */

import React from 'react';
import { Layers, FileText, Inbox } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { InboxCategory } from '../../types/inbox.types';

export interface InboxTabsProps {
  activeCategory: InboxCategory;
  onSelectCategory: (category: InboxCategory) => void;
  unreadCounts: {
    all: number;
    project: number;
    pages: number;
  };
  totalCounts?: {
    all: number;
    project: number;
    pages: number;
  };
  className?: string;
}

const TABS: Array<{
  id: InboxCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: 'all',
    label: 'All',
    icon: Inbox,
    description: 'All system notifications',
  },
  {
    id: 'project',
    label: 'Project',
    icon: Layers,
    description: 'Project invitations & team members',
  },
  {
    id: 'pages',
    label: 'Pages',
    icon: FileText,
    description: 'Comments, mentions & editor reviews',
  },
];

export default function InboxTabs({
  activeCategory,
  onSelectCategory,
  unreadCounts,
  className,
}: InboxTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Inbox category navigation"
      className={cn('flex items-center gap-1 border-b border-border px-3 py-1.5 bg-muted/20 select-none', className)}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeCategory === tab.id;
        const unread = unreadCounts[tab.id] ?? 0;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label} notifications${unread > 0 ? `, ${unread} unread` : ''}`}
            onClick={() => onSelectCategory(tab.id)}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 text-13 font-medium rounded-md transition-all duration-150 cursor-pointer outline-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-primary',
              isActive
                ? 'bg-background text-foreground shadow-sm border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <Icon className={cn('size-3.5 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
            <span className="tracking-tight">{tab.label}</span>

            {/* Unread badge for specific category */}
            {unread > 0 && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 py-0.2 rounded-full text-10 font-semibold tabular-nums leading-none',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-foreground/20 text-foreground group-hover:bg-primary/20 group-hover:text-primary'
                )}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
