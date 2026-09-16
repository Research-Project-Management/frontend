export interface WorkspaceAnalyticsStats {
  members: number;
  projects: number;
  workItems: number;
  papers: number;
  pages: number;
  files: number;
  stickies: number;
}

export interface ProjectAnalyticsDistribution {
  totalItems?: number;
  completedItems?: number;
  completionRate?: number;
  state: Record<string, number>;
  priority: Record<string, number>;
  assignee: Array<{
    userId: string;
    name: string;
    avatar: string | null;
    count: number;
  }>;
}

export interface TimeSeriesPoint {
  date: string;
  created: number;
  completed: number;
}

export interface ProjectOverviewData {
  stats?: {
    totalWorkItems: number;
    completedWorkItems: number;
    inProgressWorkItems?: number;
    completionRate?: number;
    activeCycles?: number;
  };
  recentActivities?: any[];
  [key: string]: any;
}

export interface AnalyticsPageProps {
  initialProjectId?: string;
}
