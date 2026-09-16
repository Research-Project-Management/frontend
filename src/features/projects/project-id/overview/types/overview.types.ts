export type ProjectState =
  | 'draft'
  | 'planning'
  | 'execution'
  | 'monitoring'
  | 'completed'
  | 'cancelled';

export type ProjectPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface ProjectMemberSummary {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
}

export interface ProjectLeadSummary {
  id: string;
  name: string;
  avatar: string | null;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  identifier: string;
  description: string | null;
  avatar: string | null;
  coverImage: string | null;
  state: ProjectState;
  priority: ProjectPriority;
  startDate: string | null;
  targetDate: string | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  lead: ProjectLeadSummary | null;
  totalMembers: number;
  members: ProjectMemberSummary[];
}

export interface ProjectLink {
  id: string;
  projectId: string;
  title: string;
  url: string;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    avatar: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemMetrics {
  totalWorkItems: number;
  completed: number;
  started: number;
  unstarted: number;
  backlog: number;
  cancelled: number;
  overdue: number;
  completionPercentage: number;
}

export interface ActiveCycleSummary {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  totalIssues: number;
  completedIssues: number;
  completionPercentage: number;
}

export interface RecentActivity {
  id: string;
  verb: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: {
    id: string;
    name: string;
    avatar: string | null;
  };
  createdAt: string;
}

export interface ProjectOverviewData {
  project: ProjectMetadata;
  links: ProjectLink[];
  metrics: WorkItemMetrics;
  activeCycle: ActiveCycleSummary | null;
  recentActivities: RecentActivity[];
  currentUpdate: ProjectStatusUpdate | null;
}

export type ProjectStatusIndicator = 'on_track' | 'at_risk' | 'off_track';

export interface ProjectStatusUpdate {
  id: string;
  projectId: string;
  status: ProjectStatusIndicator;
  message: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface CreateProjectStatusUpdateInput {
  status: ProjectStatusIndicator;
  message: string;
}

export interface UpdateProjectStatusUpdateInput {
  status?: ProjectStatusIndicator;
  message?: string;
}

export interface CreateLinkInput {
  title: string;
  url: string;
}

export interface UpdateLinkInput {
  title?: string;
  url?: string;
}
