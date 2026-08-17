// ── workspaces/projects public API ───────────────────────────────────────────
// Full projects domain: workspace-level sections + project detail pages.

// ── Shell (workspace sub-sidebar & shared project topbar) ──────────────────────
export { default as ProjectsSidebar } from './shell/components/Sidebar';
export { default as ProjectsTopbar } from './shell/components/project/Topbar';
export { default as ProjectsPage } from './shell/pages/ProjectsPage';
export { default as ArchivePage } from './shell/pages/ArchivePage';
export { default as ArchiveTopbar } from './shell/components/archived/ArchiveTopbar';
export { default as ArchiveCard } from './shell/components/archived/ArchiveCard';
export { default as ArchivedEmptyState } from './shell/components/archived/ArchivedEmptyState';
export { default as DeletePermanentModal } from './shell/components/archived/DeletePermanentModal';
export { default as CreateProjectModal } from './shell/components/project/CreateProjectModal';
export { default as ProjectCard } from './shell/components/project/Card';

export * from './shell/types/project.types';
export * from './shell/services/project.service';
export * from './shell/hooks/use-project';
export * from './shell/hooks/use-favorites';
export * from './shell/utils/projects-page.util';
export * from './shell/utils/archive-page.util';

// ── Workspace sections ────────────────────────────────────────────────────────
// Home
export { default as HomePage } from './home/pages/home-page';
export { getRecentItems } from './home/services/home.service';
export { useRecentItems } from './home/hooks/use-home';
export type { SectionId, SectionConfig } from './home/schemas/home.schema';

// Your Work
export { default as YourWorkTopbar } from './your-work/components/layout/Topbar';
export { default as YourWorkNavigationBar } from './your-work/components/layout/NavigationBar';
export { default as YourWorkTaskList } from './your-work/components/shared/YourWorkTaskList';
export { default as ActivityFeedItem } from './your-work/components/shared/ActivityFeedItem';
export { default as TaskDialogModal } from './your-work/components/shared/TaskDialogModal';
export { default as OverviewCards } from './your-work/components/summary/OverviewCards';
export { default as WorkloadCards } from './your-work/components/summary/WorkloadCards';
export { default as PriorityBreakdown } from './your-work/components/summary/PriorityBreakdown';
export { default as StateBreakdown } from './your-work/components/summary/StateBreakdown';
export { default as RecentActivityFeed } from './your-work/components/summary/RecentActivityFeed';
export { default as AssignedTaskList } from './your-work/components/assigned/AssignedTaskList';
export { default as CreatedTaskList } from './your-work/components/created/CreatedTaskList';
export { default as SubscribedTaskList } from './your-work/components/subscribed/SubscribedTaskList';
export { default as ActivityTimeline } from './your-work/components/activity/ActivityTimeline';
export { default as SummaryPage } from './your-work/pages/SummaryPage';
export { default as AssignedPage } from './your-work/pages/AssignedPage';
export { default as CreatedPage } from './your-work/pages/CreatedPage';
export { default as SubscribedPage } from './your-work/pages/SubscribedPage';
export { default as ActivityPage } from './your-work/pages/ActivityPage';
export * from './your-work/services/your-work.service';
export * from './your-work/schemas/your-work.schema';
export * from './your-work/hooks/use-assigned-work';
export * from './your-work/hooks/use-created-work';
export * from './your-work/hooks/use-subscribed-work';
export * from './your-work/hooks/use-activity-feed';
export * from './your-work/hooks/use-summary-work';

// All Pages
export { default as PagesPage } from './all-pages/pages/PagesPage';
export { GridView as PagesGridView, GridView } from './all-pages/components/views/GridView';
export { ListView as PagesListView, ListView } from './all-pages/components/views/ListView';
export { Card as PagesCard, Card as PageCard } from './all-pages/components/card/Card';
export { TopBar as PagesTopBar } from './all-pages/components/layout/TopBar';
export { EmptyState as PagesEmptyState } from './all-pages/components/layout/EmptyState';
export { CreateModal as PageCreateModal } from './all-pages/components/modals/CreateModal';
export * from './all-pages/types/page.types';
export * from './all-pages/schemas/page.schema';
export * from './all-pages/services/page.service';
export * from './all-pages/hooks/use-page';

// Stickies
export { default as StickyPage } from './stickies/pages/StickyPage';
export * from './stickies/services/sticky.service';
export * from './stickies/types/sticky.types';
export * from './stickies/schemas/sticky.schema';
export * from './stickies/utils/sticky.utils';
export * from './stickies/hooks/use-sticky';
export * from './stickies/hooks/use-card';

// ── Project Detail specific modules ───────────────────────────────────────────
// Overview
export { default as OverviewPage } from './project-id/overview/pages/OverviewPage';
export { Topbar as OverviewTopbar } from './project-id/overview/components/Topbar';
export { Stats as OverviewStats } from './project-id/overview/components/Stats';
export { Team as OverviewTeam } from './project-id/overview/components/Team';
export * from './project-id/overview/types/overview.types';
export * from './project-id/overview/schemas/overview.schema';
export * from './project-id/overview/services/overview.service';
export * from './project-id/overview/hooks/use-overview';

// Tasks
export { default as TaskPage } from './project-id/tasks/pages/TaskPage';
export { TaskDetailModal as TaskDialog } from './project-id/tasks/components/modals/task/TaskDetailModal';
export {
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useDuplicateTask,
} from './project-id/tasks/hooks/use-task';

// Cycles
export { CyclePage } from './project-id/cycles/pages/CyclePage';
export { CycleModal } from './project-id/cycles/components/modals/CycleModal';
export { DeleteModal as CycleDeleteModal } from './project-id/cycles/components/modals/DeleteModal';
export { StatusModal as CycleStatusModal } from './project-id/cycles/components/modals/StatusModal';
export {
  useProjectCycles,
  useCreateCycle,
  useUpdateCycle,
  useDeleteCycle,
  useCompleteCycle,
  deriveStatus,
} from './project-id/cycles/hooks/use-cycle';

// Project Storage
export { default as ProjectStorageHomePage } from './project-id/storage/pages/HomePage';
export { default as ProjectMyFilesPage } from './project-id/storage/pages/MyFilesPage';
export { default as ProjectStarredPage } from './project-id/storage/pages/StarredPage';
export { default as ProjectTrashPage } from './project-id/storage/pages/TrashPage';
export { default as ProjectSharedPage } from './project-id/storage/pages/SharedPage';
export { default as StorageTopbar } from './project-id/storage/components/layout/Topbar';
export { default as StorageNavigationBar } from './project-id/storage/components/layout/NavigationBar';
export { default as StoragePreview } from './project-id/storage/components/preview/Preview';
export { default as StorageListView } from './project-id/storage/components/views/ListView';
export { default as StorageGridView } from './project-id/storage/components/views/GridView';
export { usePreviewStore } from './project-id/storage/store/use-preview-store';
export { useViewStore } from './project-id/storage/store/use-view-store';
export * from './project-id/storage/types/storage.types';
export * from './project-id/storage/schemas/storage.schema';
export * from './project-id/storage/services/file.service';
export * from './project-id/storage/hooks/use-storage';
export * from './project-id/storage/hooks/use-preview';

// Settings
export { default as ProjectGeneralPage } from './project-id/settings/pages/GeneralPage';
export { default as ProjectModulesPage } from './project-id/settings/pages/ModulesPage';
export { default as ProjectMemberPage, default as MemberPage } from './project-id/settings/pages/MemberPage';
export { default as ProjectWorklogsPage } from './project-id/settings/pages/WorklogsPage';
export { default as ProjectCycleSettingsPage } from './project-id/settings/pages/CyclePage';
export { default as ProjectLabelPage } from './project-id/settings/pages/LabelPage';
export { default as ProjectSettingsSidebar, default as SettingsSidebar } from './project-id/settings/components/layout/Sidebar';
export { default as SettingsTopbar } from './project-id/settings/components/layout/Topbar';
export * from './project-id/settings/hooks/use-worklog';
export * from './project-id/settings/hooks/use-module';
export * from './project-id/settings/hooks/use-member';
export * from './project-id/settings/hooks/use-cycle-settings';
export * from './project-id/settings/hooks/use-general';
export * from './project-id/settings/services/label.service';
export * from './project-id/settings/services/member.service';
export * from './project-id/settings/services/worklog.service';
export * from './project-id/settings/types/settings.types';
export * from './project-id/settings/types/module.types';
export * from './project-id/settings/types/worklog.types';
