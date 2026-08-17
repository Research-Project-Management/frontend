'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface WorkloadCardsProps {
  statusBreakdown?: Record<string, number>;
  assignedTasks?: any[];
  onTaskClick?: (taskId: string) => void;
  taskProjectMap?: Record<string, { id: string; name: string }>;
}

export function WorkloadCards({
  statusBreakdown = {},
  assignedTasks,
  onTaskClick,
  taskProjectMap,
}: WorkloadCardsProps) {
  const workloadStates = [
    { label: 'Backlog', count: statusBreakdown.backlog || 0, color: 'bg-zinc-400' },
    { label: 'Not started', count: statusBreakdown.todo || 0, color: 'bg-blue-600' },
    { label: 'Working on', count: statusBreakdown.doing || 0, color: 'bg-amber-500' },
    { label: 'In review', count: statusBreakdown.review || 0, color: 'bg-yellow-400' },
    { label: 'Completed', count: statusBreakdown.done || 0, color: 'bg-emerald-600' },
    { label: 'Cancelled', count: statusBreakdown.cancelled || 0, color: 'bg-red-600' },
  ];

  return (
    <div>
      <h2 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Workload
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {workloadStates.map((state) => (
          <div
            key={state.label}
            className="p-4 rounded-lg border border-border/80 bg-card flex flex-col justify-between min-h-[82px] shadow-2xs"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('size-2.5 rounded-xs shrink-0', state.color)} />
              <span className="text-xs font-medium text-muted-foreground truncate">{state.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground pl-0.5">{state.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkloadCards;
