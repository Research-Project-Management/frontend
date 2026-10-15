'use client';

import React, { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { ActivityFeedItem } from './ActivityFeedItem';
import type { YourWorkActivityEvent } from '../../schemas/your-work.schema';

export interface ActivityFeedListProps {
  items: YourWorkActivityEvent[];
  isLoading?: boolean;
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: Record<string, { id: string; name: string }>;
  emptyPadding?: string;
  title?: string;
  showCount?: boolean;
  maxItems?: number;
  className?: string;
}

export const ActivityFeedList = React.memo<ActivityFeedListProps>(function ActivityFeedList({
  items,
  isLoading = false,
  onWorkItemClick,
  workItemProjectMap = {},
  emptyPadding = 'py-8',
  title,
  showCount = false,
  maxItems,
  className,
}: ActivityFeedListProps) {
  const displayItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return maxItems && maxItems > 0 ? items.slice(0, maxItems) : items;
  }, [items, maxItems]);

  const listContent = (
    <div className="rounded-md bg-muted/30 overflow-hidden divide-y divide-border/40 shadow-none">
      {isLoading ? (
        <div className="p-8 text-center text-12 text-muted-foreground">
          Loading recent activities...
        </div>
      ) : displayItems.length === 0 ? (
        <div className={`text-center ${emptyPadding} text-muted-foreground text-12 font-medium italic`}>
          No activity yet.
        </div>
      ) : (
        displayItems.map((activity: YourWorkActivityEvent, idx: number) => (
          <ActivityFeedItem
            key={activity.id || idx}
            activity={activity}
            onWorkItemClick={onWorkItemClick}
            workItemProjectMap={workItemProjectMap}
          />
        ))
      )}
    </div>
  );

  if (!title) {
    return listContent;
  }

  return (
    <div className={cn(showCount ? 'space-y-6' : undefined, className)}>
      {showCount ? (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-foreground font-semibold text-13 tracking-tight">
            {title}
            <span className="ml-2 text-12 font-medium text-muted-foreground tabular-nums">
              ({Array.isArray(items) ? items.length : 0})
            </span>
          </h2>
        </div>
      ) : (
        <h2 className="text-13 font-semibold text-foreground tracking-tight mb-2.5">
          {title}
        </h2>
      )}
      {listContent}
    </div>
  );
});

