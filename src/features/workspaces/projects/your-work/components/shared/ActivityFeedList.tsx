'use client';

import React from 'react';
import { ActivityFeedItem } from './ActivityFeedItem';

export interface ActivityFeedListProps {
  items: any[];
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  taskProjectMap?: Record<string, { id: string; name: string }>;
  emptyPadding?: string;
}

export function ActivityFeedList({
  items,
  isLoading = false,
  onTaskClick,
  taskProjectMap = {},
  emptyPadding = 'py-8',
}: ActivityFeedListProps) {
  return (
    <div className="rounded-md bg-muted/30 overflow-hidden divide-y divide-border/40 shadow-none">
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Loading recent activities...
        </div>
      ) : items.length === 0 ? (
        <div className={`text-center ${emptyPadding} text-muted-foreground text-xs font-medium italic`}>
          No activity yet.
        </div>
      ) : (
        items.map((activity: any, idx: number) => (
          <ActivityFeedItem
            key={activity.id || idx}
            activity={activity}
            onTaskClick={onTaskClick}
            taskProjectMap={taskProjectMap}
          />
        ))
      )}
    </div>
  );
}
