'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

export interface ActivityTimelineProps {
  activities?: any[];
  isLoading?: boolean;
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: Record<string, { id: string; name: string }>;
}

export function ActivityTimeline({
  activities = [],
  isLoading = false,
  onTaskClick,
  taskProjectMap = {},
}: ActivityTimelineProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-foreground font-semibold text-sm tracking-tight">
          Recent activity
          <span className="ml-2 text-xs font-normal text-muted-foreground">({activities.length})</span>
        </h2>
      </div>

      <div className="rounded-lg border border-border/80 bg-card overflow-hidden divide-y divide-border/60 shadow-2xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading recent activities...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs font-medium italic">
            No activity yet.
          </div>
        ) : (
          activities.map((activity: any, idx: number) => {
            const projectInfo = activity.project || (activity.itemId ? taskProjectMap[activity.itemId] : undefined);
            const timeDate = activity.time ? new Date(activity.time) : new Date();

            return (
              <div
                key={activity.id || activity._id || idx}
                onClick={() => {
                  if (activity.itemId && (activity.type?.startsWith('task') || activity.type?.includes('task'))) {
                    onTaskClick(activity.itemId);
                  }
                }}
                className={cn(
                  'flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-muted/30 text-left',
                  activity.itemId ? 'cursor-pointer group' : ''
                )}
              >
                <Avatar className="size-9 rounded-lg shrink-0 mt-0.5 border border-border/80">
                  <AvatarImage src={activity.user?.avatar} alt={activity.user?.name || 'User'} />
                  <AvatarFallback className="rounded-lg text-[11px] font-bold bg-muted">
                    {(activity.actorName || activity.user?.name || 'U').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground leading-snug">
                    <span className="font-semibold text-foreground mr-1.5">
                      {activity.actorName || activity.user?.name || 'You'}
                    </span>
                    <span className="text-muted-foreground mr-1.5">
                      {activity.actionVerb || 'performed action on'}
                    </span>
                    {activity.targetIdentifier && (
                      <span className="font-bold text-foreground mr-1.5">
                        {activity.targetIdentifier}
                      </span>
                    )}
                    {activity.targetTitle && (
                      <span className="font-normal text-foreground group-hover:text-primary transition-colors">
                        {activity.targetTitle}
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground font-normal">
                      {formatDistanceToNow(timeDate, { addSuffix: true })}
                    </span>
                    {projectInfo && (
                      <>
                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {typeof projectInfo === 'object' ? projectInfo.name : projectInfo}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ActivityTimeline;
