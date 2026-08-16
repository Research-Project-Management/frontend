// ── Your Work public API ──────────────────────────────────────────────────────

// Layout
export { default as YourWorkTopbar } from './components/layout/Topbar';
export { default as YourWorkNavigationBar } from './components/layout/NavigationBar';

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

// Services (exact backend names)
export { getYourWork, getActivityFeed, getWorkspaceTasks } from './services/your-work.service';

// Schemas & Types
export {
  yourWorkItemSchema,
  yourWorkActivityEventSchema,
  yourWorkSummaryResponseSchema,
} from './schemas/your-work.schema';
export type {
  YourWorkItem,
  YourWorkActivityEvent,
  YourWorkSummaryResponse,
} from './schemas/your-work.schema';
