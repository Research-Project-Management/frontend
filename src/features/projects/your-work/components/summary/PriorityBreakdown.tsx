'use client';

import React, { useMemo } from 'react';
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
import { BreakdownCard, BreakdownTooltip } from './BreakdownCard';

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

const PRIORITY_DEFINITIONS = [
  { key: 'urgent', label: 'Urgent', hex: '#EF4444' },
  { key: 'high', label: 'High', hex: '#F97316' },
  { key: 'medium', label: 'Medium', hex: '#F59E0B' },
  { key: 'low', label: 'Low', hex: '#22C55E' },
  { key: 'none', label: 'None', hex: '#94A3B8' },
];

export const PriorityBreakdown = React.memo<PriorityBreakdownProps>(function PriorityBreakdown({
  priorityBreakdown = {},
  total = 0,
  totalAssigned,
  className,
}: PriorityBreakdownProps) {
  const effectiveTotal = totalAssigned !== undefined ? totalAssigned : total;

  const priorities: PriorityItem[] = useMemo(() => PRIORITY_DEFINITIONS.map((def) => ({
    ...def,
    count: priorityBreakdown[def.key] || 0,
  })), [priorityBreakdown]);

  const isEmpty =
    effectiveTotal === 0 || priorities.every((p) => (p.count || 0) === 0);

  return (
    <BreakdownCard
      title="Work items by priority"
      isEmpty={isEmpty}
      className={className}
    >
      {(isMounted) => (
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
                      <BreakdownTooltip
                        total={effectiveTotal}
                        labelSuffix=" Priority"
                        countSuffix=" items"
                      />
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
              <div key={item.key} className="flex items-center gap-1.5 text-12">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.hex }}
                />
                <span className="text-11 font-medium text-muted-foreground hidden sm:inline">
                  {item.label}
                </span>
                <span className="text-12 font-medium text-foreground tabular-nums">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </BreakdownCard>
  );
});

export default PriorityBreakdown;

