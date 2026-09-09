'use client';

import React from 'react';
import { BreakdownCard } from './BreakdownCard';
import { getWorkloadStates } from '../../utils/workload.util';

export interface StateBreakdownProps {
  statusBreakdown?: Record<string, number>;
  total?: number;
  totalAssigned?: number;
  className?: string;
}

export function StateBreakdown({
  statusBreakdown = {},
  total = 0,
  totalAssigned,
  className,
}: StateBreakdownProps) {
  const effectiveTotal = totalAssigned !== undefined ? totalAssigned : total;
  const workloadStates = getWorkloadStates(statusBreakdown);

  return (
    <BreakdownCard
      title="Work items by state"
      items={workloadStates}
      total={effectiveTotal}
      className={className}
    />
  );
}

export default StateBreakdown;
