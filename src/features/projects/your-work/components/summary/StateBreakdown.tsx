'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { BreakdownCard, BreakdownTooltip } from './BreakdownCard';
import { getWorkloadStates } from '../../utils/workload.util';

export interface StateBreakdownProps {
  statusBreakdown?: Record<string, number>;
  total?: number;
  totalAssigned?: number;
  className?: string;
}

export const StateBreakdown = React.memo<StateBreakdownProps>(function StateBreakdown({
  statusBreakdown = {},
  total = 0,
  totalAssigned,
  className,
}: StateBreakdownProps) {
  const effectiveTotal = totalAssigned !== undefined ? totalAssigned : total;
  const workloadStates = useMemo(() => getWorkloadStates(statusBreakdown), [statusBreakdown]);
  const isEmpty = effectiveTotal === 0 || workloadStates.every((s) => (s.count || 0) === 0);

  // Filter out states with 0 items for the donut slices
  const chartData = useMemo(() => workloadStates.filter((s) => s.count > 0), [workloadStates]);

  return (
    <BreakdownCard
      title="Work items by state"
      isEmpty={isEmpty}
      className={className}
    >
      {(isMounted) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center h-full">
          {/* Left Column: Donut Chart with Center Total */}
          <div className="relative flex items-center justify-center h-[200px] w-full">
            {isMounted ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip
                      content={
                        <BreakdownTooltip
                          total={effectiveTotal}
                          dotClassName="size-2 rounded-xs shrink-0"
                        />
                      }
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
                  className="flex items-center justify-between gap-2 text-12"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: group.hex }}
                    />
                    <span className="text-12 font-medium text-muted-foreground truncate">
                      {group.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span className="text-12 font-medium text-foreground tabular-nums">
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
    </BreakdownCard>
  );
});

export default StateBreakdown;