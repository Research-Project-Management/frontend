export interface WorkloadStateItem {
  label: string;
  count: number;
  color: string;
}

export function getWorkloadStates(statusBreakdown: Record<string, number> = {}): WorkloadStateItem[] {
  return [
    { label: 'Backlog', count: statusBreakdown.backlog || 0, color: 'bg-muted-foreground' },
    { label: 'Not started', count: statusBreakdown.todo || 0, color: 'bg-primary' },
    { label: 'Working on', count: statusBreakdown.doing || 0, color: 'bg-warning' },
    { label: 'In review', count: statusBreakdown.review || 0, color: 'bg-warning' },
    { label: 'Completed', count: statusBreakdown.done || 0, color: 'bg-success' },
    { label: 'Cancelled', count: statusBreakdown.cancelled || 0, color: 'bg-destructive' },
  ];
}
