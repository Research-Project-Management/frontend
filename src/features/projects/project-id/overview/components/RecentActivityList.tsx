'use client';

import React from 'react';
import { RecentActivity } from '../types/overview.types';
import { Activity, User } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface RecentActivityListProps {
  activities: RecentActivity[];
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

function formatVerb(activity: RecentActivity): string {
  const { verb, field, oldValue, newValue } = activity;
  if (verb === 'created') return 'created a work item';
  if (verb === 'deleted') return 'deleted a work item';
  if (verb === 'updated' && field) {
    if (oldValue && newValue) {
      return `changed ${field} from "${oldValue}" to "${newValue}"`;
    }
    return `updated ${field}`;
  }
  return verb.replace(/_/g, ' ');
}

export function RecentActivityList({ activities }: RecentActivityListProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Recent Activity
        </h2>
      </div>

      {activities.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No recent activity recorded yet.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/50">
          {activities.map((act) => (
            <div key={act.id} className="py-2.5 flex items-start gap-3 text-xs first:pt-1 last:pb-0">
              {/* Actor avatar */}
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden shrink-0 mt-0.5">
                {act.actor.avatar ? (
                  <img
                    src={act.actor.avatar}
                    alt={act.actor.name || 'User'}
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-3.5" />
                )}
              </div>

              {/* Action content */}
              <div className="flex-1 min-w-0">
                <p className="text-foreground leading-snug">
                  <span className="font-semibold text-foreground mr-1">
                    {act.actor.name || 'Anonymous'}
                  </span>
                  <span className="text-muted-foreground">
                    {formatVerb(act)}
                  </span>
                </p>
                <span className="text-11 text-muted-foreground/70 mt-0.5 block">
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
