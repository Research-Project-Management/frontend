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
    { key: 'urgent', label: 'Urgent', color: 'text-destructive', dot: 'bg-destructive' },
    { key: 'high', label: 'High', color: 'text-warning', dot: 'bg-warning' },
    { key: 'medium', label: 'Medium', color: 'text-warning', dot: 'bg-warning' },
    { key: 'low', label: 'Low', color: 'text-primary', dot: 'bg-primary' },
    { key: 'none', label: 'None', color: 'text-muted-foreground', dot: 'bg-muted-foreground/60' },
  ];

  return (
    <div className={cn('flex-1 flex flex-col', className)}>
      <h3 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Work items by Priority
      </h3>
      <div className="flex-1 rounded-lg border border-border bg-card p-6 flex flex-col justify-center items-center shadow-none min-h-[180px]">
        {effectiveTotal === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <div className="relative size-16 mb-2 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg border border-border bg-muted rotate-6" />
              <div className="absolute inset-0 rounded-lg border border-border bg-card -rotate-3" />
              <div className="relative size-12 rounded-lg border border-border bg-card flex items-center justify-center shadow-none">
                <BarChart2 className="size-6 text-muted-foreground/40 stroke-[1.5] shrink-0" />
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
                  className="p-3 rounded-lg bg-muted border border-border flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn('size-2 rounded-full', p.dot)} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {p.label}
                    </span>
                  </div>
                  <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">{count}</p>
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
