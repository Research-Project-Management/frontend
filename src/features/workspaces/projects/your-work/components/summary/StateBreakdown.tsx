'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { cn } from "@/shared/lib/utils";
import { EmptyIllustration } from './BreakdownCard';
import { getWorkloadStates, type WorkloadStateItem } from '../../utils/workload.util';

export interface StateBreakdownProps {
  statusBreakdown?: Record<string, number>;
  total?: number;
  totalAssigned?: number;
  className?: string;
}

interface StateTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WorkloadStateItem }>;
  total: number;
}

function StateCustomTooltip({ active, payload, total }: StateTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const percentage = total > 0 ? Math.round((data.count / total) * 100) : 0;

  return (
    <div className="rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground border border-border">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          className="size-2 rounded-xs shrink-0"
          style={{ backgroundColor: data.hex }}
        />
        <span>{data.label}</span>
      </div>
      <div className="mt-1 text-11 text-muted-foreground flex items-center gap-1">
        <span className="font-semibold text-foreground tabular-nums">{data.count}</span>
        <span>({percentage}%)</span>
      </div>
    </div>
  );
}

export function StateBreakdown({
  statusBreakdown = {},
  total = 0,
  totalAssigned,
  className,
}: StateBreakdownProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveTotal = totalAssigned !== undefined ? totalAssigned : total;
  const workloadStates = getWorkloadStates(statusBreakdown);
  const isEmpty = effectiveTotal === 0 || workloadStates.every((s) => (s.count || 0) === 0);

  // Filter out states with 0 items for the donut slices
  const chartData = workloadStates.filter((s) => s.count > 0);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        Work items by state
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center h-full">
            {/* Left Column: Donut Chart with Center Total */}
            <div className="relative flex items-center justify-center h-[200px] w-full">
              {isMounted ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip
                        content={<StateCustomTooltip total={effectiveTotal} />}
                      />
                      <Pie
                        data={chartData}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={50}
                        outerRadius={76}
                        paddingAngle={chartData.length > 1 ? 4 : 0}
                        cornerRadius={4}
                        stroke="transparent"
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.hex} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Counter */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-semibold text-foreground tabular-nums leading-none">
                      {effectiveTotal}
                    </span>
                    <span className="text-10 text-muted-foreground font-medium mt-1">
                      Total
                    </span>
                  </div>
                </>
              ) : (
                <div className="size-36 rounded-full border-4 border-muted/60 animate-pulse" />
              )}
            </div>

            {/* Right Column: Legend List */}
            <div className="flex flex-col justify-center space-y-2.5 w-full pr-1">
              {workloadStates.map((group) => {
                const percentage =
                  effectiveTotal > 0
                    ? Math.round((group.count / effectiveTotal) * 100)
                    : 0;

                return (
                  <div
                    key={group.key}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: group.hex }}
                      />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {group.count}
                      </span>
                      <span className="text-10 text-muted-foreground tabular-nums">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StateBreakdown;