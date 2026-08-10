// ── shell/index.ts ────────────────────────────────────────────────────────────
// Shell = workspace-level chrome and shared workspace data layer.
// Exposes: top-level UI components, workspace hooks, types, and store.

// ── Components ────────────────────────────────────────────────────────────────
export { default as WorkspaceTopbar } from './components/Topbar';
export { default as WorkspaceSidebar } from './components/Sidebar';
export { default as WorkspaceAvatar } from './components/Avatar';

// ── Pages ─────────────────────────────────────────────────────────────────────


export {
  useWorkspace,
  useWorkspaces,
  useWorkspaceById,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from './hooks/use-workspace';


// ── Services (cache helpers + workspace CRUD fetchers) ────────────────────────
export { createWorkspace } from './services/workspace.service';


