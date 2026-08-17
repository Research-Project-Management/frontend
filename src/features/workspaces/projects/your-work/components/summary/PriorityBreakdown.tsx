'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface PriorityBreakdownProps {
  priorityBreakdown?: Record<string, number>;
  total?: number;
  totalAssigned?: number;
  className?: string;
}

export function PriorityBreakdown({
  priorityBreakdown = {},
  total = 0,
  totalAssigned,
  className,
}: PriorityBreakdownProps) {
  const effectiveTotal = totalAssigned !== undefined ? totalAssigned : total;
  const priorities = [
    { key: 'urgent', label: 'Urgent', color: 'text-red-600', dot: 'bg-red-500' },
    { key: 'high', label: 'High', color: 'text-orange-600', dot: 'bg-orange-500' },
    { key: 'medium', label: 'Medium', color: 'text-amber-600', dot: 'bg-amber-500' },
    { key: 'low', label: 'Low', color: 'text-blue-600', dot: 'bg-blue-500' },
    { key: 'none', label: 'None', color: 'text-zinc-400', dot: 'bg-zinc-400' },
  ];

  return (
    <div className={cn('flex-1 flex flex-col', className)}>
      <h3 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Work items by Priority
      </h3>
      <div className="flex-1 rounded-lg border border-border/80 bg-card p-6 flex flex-col justify-center items-center shadow-2xs min-h-[180px]">
        {effectiveTotal === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <div className="relative size-16 mb-2 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg border border-border/60 bg-muted/20 rotate-6" />
              <div className="absolute inset-0 rounded-lg border border-border/70 bg-card -rotate-3" />
              <div className="relative size-12 rounded-lg border border-border/90 bg-card flex items-center justify-center shadow-2xs">
                <BarChart2 className="size-6 text-muted-foreground/40 stroke-[1.5]" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              No work item assigned yet
            </p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
            {priorities.map((p) => {
              const count = priorityBreakdown[p.key] || 0;
              return (
                <div
                  key={p.key}
                  className="p-3 rounded-lg bg-muted/30 border border-border/60 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('size-2 rounded-full', p.dot)} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {p.label}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{count}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PriorityBreakdown;
