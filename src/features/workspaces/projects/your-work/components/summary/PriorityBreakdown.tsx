'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { cn } from "@/shared/lib/utils";
import { EmptyIllustration } from './BreakdownCard';

export interface PriorityBreakdownProps {
  priorityBreakdown?: Record<string, number>;
  total?: number;
  totalAssigned?: number;
  className?: string;
}

interface PriorityItem {
  key: string;
  label: string;
  count: number;
  hex: string;
}

interface PriorityTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PriorityItem }>;
  total: number;
}

function PriorityCustomTooltip({ active, payload, total }: PriorityTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const percentage = total > 0 ? Math.round((data.count / total) * 100) : 0;

  return (
    <div className="rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground border border-border">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: data.hex }}
        />
        <span>{data.label} Priority</span>
      </div>
      <div className="mt-1 text-11 text-muted-foreground flex items-center gap-1">
        <span className="font-semibold text-foreground tabular-nums">{data.count} items</span>
        <span>({percentage}%)</span>
      </div>
    </div>
  );
}

const PRIORITY_DEFINITIONS = [
  { key: 'urgent', label: 'Urgent', hex: '#EF4444' },
  { key: 'high', label: 'High', hex: '#F97316' },
  { key: 'medium', label: 'Medium', hex: '#F59E0B' },
  { key: 'low', label: 'Low', hex: '#22C55E' },
  { key: 'none', label: 'None', hex: '#94A3B8' },
];

export function PriorityBreakdown({
  priorityBreakdown = {},
  total = 0,
  totalAssigned,
  className,
}: PriorityBreakdownProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveTotal = totalAssigned !== undefined ? totalAssigned : total;

  const priorities: PriorityItem[] = PRIORITY_DEFINITIONS.map((def) => ({
    ...def,
    count: priorityBreakdown[def.key] || 0,
  }));

  const isEmpty =
    effectiveTotal === 0 || priorities.every((p) => (p.count || 0) === 0);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        Work items by priority
      </h3>

      <div className="rounded-md bg-muted/40 p-5 min-h-[290px] flex flex-col justify-center">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <EmptyIllustration />
            <span className="text-xs text-muted-foreground mt-3 font-normal">
              No work item assigned yet
            </span>
          </div>
        ) : (
          <div className="flex flex-col justify-between h-full space-y-3">
            {/* Vertical Bar Chart */}
            <div className="h-[190px] w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={priorities}
                    margin={{ top: 14, right: 14, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      className="stroke-border/40"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      className="text-11 fill-muted-foreground font-medium"
                      dy={6}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      className="text-11 fill-muted-foreground"
                      width={32}
                    />
                    <RechartsTooltip
                      content={
                        <PriorityCustomTooltip total={effectiveTotal} />
                      }
                      cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
                    />
                    <Bar
                      dataKey="count"
                      barSize={26}
                      radius={[4, 4, 0, 0]}
                    >
                      {priorities.map((entry) => (
                        <Cell key={entry.key} fill={entry.hex} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-md bg-muted/30 animate-pulse" />
              )}
            </div>

            {/* Bottom Numeric Legend Strip */}
            <div className="flex items-center justify-between gap-1 pt-2.5 border-t border-border/40">
              {priorities.map((item) => (
                <div key={item.key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.hex }}
                  />
                  <span className="text-11 font-medium text-muted-foreground hidden sm:inline">
                    {item.label}
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PriorityBreakdown;
