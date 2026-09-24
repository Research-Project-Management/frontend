'use client';

/**
 * features/inbox/components/InboxView.tsx
 * Standalone Full-Page Inbox View supporting All, Project, and Pages (Manuscripts/Editor).
 */

import React, { useState, useMemo } from 'react';
import {
  Inbox,
  CheckCheck,
  RotateCw,
  Search,
  Filter,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useInbox } from '../hooks/use-inbox';
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
      items = items.filter((n) => !n.isRead);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((n) => {
        const actor = n.messageOpts?.actorName?.toLowerCase() || '';
        const project = n.messageOpts?.projectName?.toLowerCase() || '';
        const doc = n.messageOpts?.docName?.toLowerCase() || '';
        const snippet = n.messageOpts?.snippet?.toLowerCase() || '';
        return (
          actor.includes(q) ||
          project.includes(q) ||
          doc.includes(q) ||
          snippet.includes(q)
        );
      });
    }

    return items;
  }, [filteredNotifications, unreadOnly, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-background overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 h-13 border-b border-border bg-background shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Inbox className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight leading-none">
              Inbox
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review mentions, comments, and project invitations
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums">
              {unreadCount} unread
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Unread Only Toggle */}
          <button
            type="button"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors border outline-none cursor-pointer',
              unreadOnly
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Filter className="size-3.5" />
            <span>Unread only</span>
          </button>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
            >
              <CheckCheck className="size-3.5 text-muted-foreground" />
              <span>Mark all as read</span>
            </button>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={() => refresh()}
            className="size-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
            title="Refresh inbox"
          >
            <RotateCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex items-center justify-between border-b border-border bg-background/90 px-6 py-2 gap-4 shrink-0">
        <InboxTabs
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          unreadCounts={unreadCategoryCounts}
          totalCounts={categoryCounts}
          className="border-b-0 p-0"
        />

        {/* Quick Search Box */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inbox..."
            className="h-8 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      {/* Main Notification Content List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-2">
          {isLoading && displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm">Loading your notifications...</p>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4 rounded-xl border border-dashed border-border bg-muted/10">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <CheckCircle className="size-6 text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {searchQuery
                  ? 'No notifications match your search'
                  : unreadOnly
                  ? 'No unread notifications'
                  : activeCategory === 'project'
                  ? 'No project invitations or team alerts'
                  : activeCategory === 'pages'
                  ? 'No manuscript comments or mentions'
                  : 'You are all caught up!'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {activeCategory === 'pages'
                  ? 'When teammates comment or mention you in manuscript documents (Pages), they will be organized here.'
                  : 'New notifications will appear here in real-time as your team collaborates.'}
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
      </div>
    </div>
  );
}
