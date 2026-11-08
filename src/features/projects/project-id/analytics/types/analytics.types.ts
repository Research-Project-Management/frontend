export interface AssigneeWorkloadItem {
  userId: string;
  name: string;
  avatar: string | null;
  count: number;
  completedCount?: number;
  inProgressCount?: number;
  overdueCount?: number;
}

export interface StateColumnBreakdown {
  id: string;
  name: string;
  group: string;
  color: string;
  count: number;
}

export interface LabelBreakdownItem {
  id?: string;
  label: string;
  color?: string;
  count: number;
}

export interface TimeSeriesPoint {
  date: string;
  created: number;
  completed: number;
}

export interface ProjectAnalyticsData {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  overdueItems: number;
  unassignedItems: number;
  completionRate: number;
  state: Record<string, number>;
  stateGroups: Record<string, number>;
  states: StateColumnBreakdown[];
  priority: Record<string, number>;
  assignee: AssigneeWorkloadItem[];
  labels: LabelBreakdownItem[];
}
