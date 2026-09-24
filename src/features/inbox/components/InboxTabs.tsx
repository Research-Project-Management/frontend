'use client';

/**
 * features/inbox/components/InboxTabs.tsx
 * Tab Switcher for Inbox: All, Project, Pages (Manuscripts / Editor).
 */

import React from 'react';
import { Layers, FileText, Inbox } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { InboxCategory } from '../types/inbox.types';

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
      aria-label="Inbox Filter Tabs"
      className={cn(
        'flex items-center gap-1 border-b border-border bg-background/95 px-3 py-1.5 select-none shrink-0',
        className
      )}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeCategory === tab.id;
        const unread = unreadCounts[tab.id] || 0;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectCategory(tab.id)}
            className={cn(
              'group relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all outline-none cursor-pointer',
              isActive
                ? 'bg-muted text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'size-3.5 shrink-0 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )}
            />
            <span>{tab.label}</span>

            {/* Unread Badge */}
            {unread > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums leading-none',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-foreground/20 text-foreground'
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
