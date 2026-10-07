'use client';

/**
 * features/shell/components/inbox/InboxView.tsx
 * Standalone Full-Page Inbox View supporting All, Project, and Pages (Manuscripts/Editor).
 */

import React, { useState, useMemo } from 'react';
import {
  Inbox,
  CheckCheck,
  RotateCw,
  Search,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useInbox } from '../../hooks/use-inbox';
import InboxTabs from './InboxTabs';
import InboxItem from './InboxItem';

export default function InboxView() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

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

  // Search and unread filter
  const displayedItems = useMemo(() => {
    let items = filteredNotifications;

    if (unreadOnly) {
      items = items.filter((i) => !i.isRead);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((i) => {
        const text = [
          i.messageOpts?.actorName,
          i.messageOpts?.inviterName,
          i.messageOpts?.projectName,
          i.messageOpts?.docName,
          i.messageOpts?.snippet,
          i.messageOpts?.quote,
          i.templateKey,
          i.type,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(q);
      });
    }

    return items;
  }, [filteredNotifications, unreadOnly, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* ── Top Header Bar ── */}
      <header className="h-11 min-h-11 border-b border-border px-4 sm:px-6 flex items-center justify-between bg-background shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Inbox className="size-3.5" />
          </div>
          <h1 className="text-14 font-semibold text-foreground tracking-tight">Inbox</h1>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-10 font-semibold tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Global Inbox Actions */}
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <CheckCheck className="size-3.5" />
              <span className="hidden sm:inline">Mark all as read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => refresh()}
            title="Refresh inbox"
            className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <RotateCw className="size-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main Area with Navigation Tabs & Filter Bar ── */}
      <div className="border-b border-border bg-background/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-2 sm:px-4">
        {/* Category Tabs */}
        <InboxTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          unreadCounts={unreadCategoryCounts}
          totalCounts={categoryCounts}
          className="border-b-0 bg-transparent px-0"
        />

        {/* Search & Unread Toggle Toolbar */}
        <div className="flex items-center gap-2 py-1.5 px-2 sm:px-0">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-8 pr-2.5 text-12 rounded-md bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 focus:bg-background transition-colors"
            />
          </div>

          {/* Unread Only Filter Pill */}
          <button
            type="button"
            onClick={() => setUnreadOnly((prev) => !prev)}
            className={cn(
              'h-7 px-2.5 rounded-md text-12 font-medium transition-colors border cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0',
              unreadOnly
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
            )}
          >
            Unread only
          </button>
        </div>
      </div>

      {/* ── Notification Content Feed ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full divide-y divide-border/60">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-13">Loading activity stream...</p>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="size-12 rounded-full bg-muted/50 border border-border flex items-center justify-center mb-3 text-muted-foreground">
                <CheckCircle className="size-6 text-muted-foreground/80" />
              </div>
              <h2 className="text-14 font-semibold text-foreground tracking-tight">
                {searchQuery || unreadOnly ? 'No matching notifications' : 'All caught up!'}
              </h2>
              <p className="text-12 text-muted-foreground mt-1 max-w-sm">
                {searchQuery || unreadOnly
                  ? 'Try clearing the search or switching off the unread filter to see more notifications.'
                  : 'You have read all notifications in this section. New mentions and invitations will appear here in real time.'}
              </p>
            </div>
          ) : (
            displayedItems.map((item) => (
              <InboxItem
                key={item.id}
                item={item}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
