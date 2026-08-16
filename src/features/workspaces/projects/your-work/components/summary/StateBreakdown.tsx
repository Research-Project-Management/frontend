'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface StateBreakdownProps {
  statusBreakdown?: Record<string, number>;
  totalAssigned?: number;
}

export function StateBreakdown({
  statusBreakdown = {},
  totalAssigned = 0,
}: StateBreakdownProps) {
  const workloadStates = [
    { label: 'Backlog', count: statusBreakdown.backlog || 0, color: 'bg-zinc-400' },
    { label: 'Not started', count: statusBreakdown.todo || 0, color: 'bg-blue-600' },
    { label: 'Working on', count: (statusBreakdown.doing || 0) + (statusBreakdown.review || 0), color: 'bg-amber-500' },
    { label: 'Completed', count: statusBreakdown.done || 0, color: 'bg-emerald-600' },
    { label: 'Cancelled', count: statusBreakdown.cancelled || 0, color: 'bg-red-600' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Work items by state
      </h3>
      <div className="flex-1 rounded-lg border border-border/80 bg-card p-6 flex flex-col justify-center items-center shadow-2xs min-h-[180px]">
        {totalAssigned === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <div className="relative size-16 mb-2 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg border border-border/60 bg-muted/20 rotate-6" />
              <div className="absolute inset-0 rounded-lg border border-border/70 bg-card -rotate-3" />
              <div className="relative size-12 rounded-lg border border-border/90 bg-card flex items-center justify-center shadow-2xs">
                <BarChart2 className="size-6 text-muted-foreground/40 stroke-[1.5]" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">No work item assigned yet</p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
            {workloadStates.map((state) => (
              <div key={state.label} className="p-3 rounded-lg bg-muted/30 border border-border/60 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('size-2 rounded-full', state.color)} />
                  <span className="text-xs font-medium text-muted-foreground truncate">{state.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{state.count}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StateBreakdown;
