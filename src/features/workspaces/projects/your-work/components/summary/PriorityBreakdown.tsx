'use client';

import React from 'react';
import { BreakdownCard } from './BreakdownCard';

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
    { key: 'urgent', label: 'Urgent', color: 'bg-destructive', count: priorityBreakdown.urgent || 0 },
    { key: 'high', label: 'High', color: 'bg-warning', count: priorityBreakdown.high || 0 },
    { key: 'medium', label: 'Medium', color: 'bg-warning', count: priorityBreakdown.medium || 0 },
    { key: 'low', label: 'Low', color: 'bg-primary', count: priorityBreakdown.low || 0 },
    { key: 'none', label: 'None', color: 'bg-muted-foreground/60', count: priorityBreakdown.none || 0 },
  ];

  return (
    <BreakdownCard
      title="Work items by Priority"
      items={priorities}
      total={effectiveTotal}
      className={className}
    />
  );
}

export default PriorityBreakdown;
