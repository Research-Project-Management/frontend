'use client';

/**
 * features/inbox/components/InboxPopover.tsx
 * Topbar Notification Bell Popover connecting to All, Project, Pages inbox.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  RotateCw,
  ExternalLink,
  Inbox,
  Loader2,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useInbox } from '../hooks/use-inbox';
import InboxTabs from './InboxTabs';
import InboxItem from './InboxItem';

export interface InboxPopoverProps {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  className?: string;
}

export default function InboxPopover({
  align = 'end',
  sideOffset = 8,
  className,
}: InboxPopoverProps) {
  const [open, setOpen] = useState<boolean>(false);
  const {
    filteredNotifications,
    activeCategory,
    setActiveCategory,
    isLoading,
    unreadCount,
    unreadCategoryCounts,
    categoryCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  } = useInbox();

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Open notifications inbox"
                className={cn(
                  'relative flex size-8 items-center justify-center rounded-md border border-border bg-white dark:bg-card text-foreground shadow-2xs transition-colors hover:border-foreground/30 hover:bg-muted/50 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                  className
                )}
              >
                <Bell className="size-4 text-foreground shrink-0" />

                {/* Live Unread Badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background leading-none tabular-nums animate-in zoom-in-50 duration-200">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            <span>Inbox ({unreadCount} unread)</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        className="w-[410px] p-0 shadow-lg border border-border bg-background rounded-xl overflow-hidden z-50 select-none"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Inbox</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mark All Read Button */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                title="Mark all as read"
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <CheckCheck className="size-3.5" />
                <span>Mark all read</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={() => refresh()}
              title="Refresh inbox"
              className="size-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <RotateCw className={cn('size-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 3 Categories: All, Project, Pages */}
        <InboxTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          unreadCounts={unreadCategoryCounts}
          totalCounts={categoryCounts}
        />

        {/* Scrollable Notification List */}
        <div className="max-h-[380px] min-h-[160px] overflow-y-auto p-2 space-y-1.5 divide-y divide-border/20">
          {isLoading && filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Loading inbox...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                <Inbox className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                {activeCategory === 'project'
                  ? 'No project invitations or alerts'
                  : activeCategory === 'pages'
                  ? 'No comments, mentions, or page reviews'
                  : 'All caught up!'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[240px]">
                {activeCategory === 'pages'
                  ? 'When colleagues comment or mention you in documents, they will appear here.'
                  : 'You have no notifications in this category.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <InboxItem
                key={item.id}
                item={item}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onClosePopover={handleClose}
              />
            ))
          )}
        </div>

        {/* Bottom Footer */}
        <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {categoryCounts[activeCategory]} {activeCategory} item{categoryCounts[activeCategory] === 1 ? '' : 's'}
          </span>
          <Link
            href="/inbox"
            onClick={handleClose}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <span>Open full inbox</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
