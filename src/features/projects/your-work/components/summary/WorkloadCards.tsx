'use client';

import React, { useMemo } from 'react';
import { getWorkloadStates, type WorkloadStateItem } from '../../utils/workload.util';

export interface WorkloadCardsProps {
  statusBreakdown?: Record<string, number>;
}

export const WorkloadCards = React.memo<WorkloadCardsProps>(function WorkloadCards({
  statusBreakdown = {},
}: WorkloadCardsProps) {
  const workloadStates = useMemo(() => getWorkloadStates(statusBreakdown), [statusBreakdown]);

  return (
    <div className="space-y-2">
      <h2 className="text-13 font-semibold text-foreground tracking-tight mb-2.5">
        Workload
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {workloadStates.map((state: WorkloadStateItem) => (
          <div
            key={state.label}
            className="p-3.5 rounded-md bg-muted/40 hover:bg-muted/70 flex flex-col justify-between min-h-[76px] shadow-none transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className="size-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: state.hex }}
              />
              <span className="text-12 font-normal text-muted-foreground truncate">
                {state.label}
              </span>
            </div>
            <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground mt-2">
              {state.count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});

export default WorkloadCards;

