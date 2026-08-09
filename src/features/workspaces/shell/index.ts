// ── shell/index.ts ────────────────────────────────────────────────────────────
// Shell = workspace-level chrome and shared workspace data layer.
// Exposes: top-level UI components, workspace hooks, types, and store.

// ── Components ────────────────────────────────────────────────────────────────
export { default as WorkspaceTopbar } from './components/Topbar';
export { default as WorkspaceSidebar } from './components/Sidebar';
export { default as WorkspaceAvatar } from './components/avatar';

// ── Pages ─────────────────────────────────────────────────────────────────────
export { default as WorkspacePage } from './pages/WorkspacePage';

// ── Hooks: Workspace queries ───────────────────────────────────────────────────
export {
  useWorkspace,
  useWorkspaces,
  useWorkspaceById,
  useWorkspaceProjects,
  useProjects,
} from './hooks/use-workspace';

// ── Hooks: Workspace mutations ─────────────────────────────────────────────────
export {
  useUpdateWorkspace,
  useDeleteWorkspace,
  useRecentItems,
  useActivityFeed,
} from './hooks/use-workspace-mutations';

// ── Hooks: Topbar ─────────────────────────────────────────────────────────────
export { useTopbar } from './hooks/use-topbar';

// ── Store ─────────────────────────────────────────────────────────────────────
export { useWorkspaceActionsStore } from './store/workspace.store';
export type { PendingComment } from './store/workspace.store';

// ── Services (cache helpers + workspace CRUD fetchers) ────────────────────────
export { syncWorkspaceIntoCaches, createWorkspace } from './services/workspace.service';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  WorkspacePatch,
  RecentItem,
  Activity,
  Role,
  Permission,
  DeleteWorkspaceResult,
} from './types/workspace.types';

export { RESOURCES, ACTIONS } from './types/workspace.types';
