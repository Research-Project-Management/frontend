'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface BreakdownItem {
  key?: string;
  label: string;
  count: number;
  color: string;
}

export interface BreakdownCardProps {
  title: string;
  items: BreakdownItem[];
  total: number;
  className?: string;
}

export function BreakdownCard({
  title,
  items,
  total,
  className,
}: BreakdownCardProps) {
  return (
    <div className={cn('flex-1 flex flex-col', className)}>
      <h3 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        {title}
      </h3>
      <div className="flex-1 rounded-lg border border-border bg-card p-6 flex flex-col justify-center items-center shadow-none min-h-[180px]">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-2">
            <div className="relative size-16 mb-2 flex items-center justify-center">
              <div className="absolute inset-0 rounded-md border border-border bg-muted rotate-6" />
              <div className="absolute inset-0 rounded-md border border-border bg-card -rotate-3" />
              <div className="relative size-12 rounded-md border border-border bg-card flex items-center justify-center shadow-none">
                <BarChart2 className="size-6 text-muted-foreground stroke-[1.5] shrink-0" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              No work item assigned yet
            </p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item) => (
              <div
                key={item.key || item.label}
                className="p-3 rounded-md bg-muted border border-border flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('size-2 rounded-full', item.color)} />
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {item.label}
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
