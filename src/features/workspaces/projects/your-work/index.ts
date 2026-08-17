// ── Your Work public API ──────────────────────────────────────────────────────

// Layout & Shared Components
export { default as YourWorkTopbar } from './components/layout/Topbar';
export { default as YourWorkNavigationBar } from './components/layout/NavigationBar';
export { default as YourWorkTaskList } from './components/shared/YourWorkTaskList';
export { default as ActivityFeedItem } from './components/shared/ActivityFeedItem';
export { default as TaskDialogModal } from './components/shared/TaskDialogModal';

// Summary Components
export { default as OverviewCards } from './components/summary/OverviewCards';
export { default as WorkloadCards } from './components/summary/WorkloadCards';
export { default as PriorityBreakdown } from './components/summary/PriorityBreakdown';
export { default as StateBreakdown } from './components/summary/StateBreakdown';
export { default as RecentActivityFeed } from './components/summary/RecentActivityFeed';

// List & Timeline Components
export { default as AssignedTaskList } from './components/assigned/AssignedTaskList';
export { default as CreatedTaskList } from './components/created/CreatedTaskList';
export { default as SubscribedTaskList } from './components/subscribed/SubscribedTaskList';
export { default as ActivityTimeline } from './components/activity/ActivityTimeline';

// Pages
export { default as SummaryPage } from './pages/SummaryPage';
export { default as AssignedPage } from './pages/AssignedPage';
export { default as CreatedPage } from './pages/CreatedPage';
export { default as SubscribedPage } from './pages/SubscribedPage';
export { default as ActivityPage } from './pages/ActivityPage';

// Hooks
export { useSummaryWork } from './hooks/use-summary-work';
export { useAssignedWork } from './hooks/use-assigned-work';
export { useCreatedWork } from './hooks/use-created-work';
export { useSubscribedWork } from './hooks/use-subscribed-work';
export { useActivityFeed } from './hooks/use-activity-feed';
export { useTaskModal } from './hooks/use-task-modal';

// Services
export { getYourWork, getActivityFeed, getWorkspaceTasks } from './services/your-work.service';

// Utils
export {
  createProjectMap,
  createTaskProjectMap,
  getTaskProjectId,
  getTaskProject,
  categorizeTasks,
  getDefaultStatusBreakdown,
  getDefaultPriorityBreakdown,
} from './utils/your-work.util';
export type {
  ProjectInfo as YourWorkProjectInfo,
  ProjectMap,
  CategorizedTasksResult,
} from './utils/your-work.util';

// Schemas & Types
export {
  yourWorkItemSchema,
  yourWorkTaskSchema,
  yourWorkSubtaskSchema,
  yourWorkUserRefSchema,
  yourWorkActivityEventSchema,
  yourWorkSummaryResponseSchema,
} from './schemas/your-work.schema';
export type {
  YourWorkItem,
  YourWorkTask,
  YourWorkSubtask,
  YourWorkActivityEvent,
  YourWorkSummaryResponse,
} from './schemas/your-work.schema';
