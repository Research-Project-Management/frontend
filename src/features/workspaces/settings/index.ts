// ── settings/index.ts ─────────────────────────────────────────────────────────
// Settings feature public API.
// Owns: workspace member management, roles, and settings UI components.

// ── Components ────────────────────────────────────────────────────────────────
export { default as DeleteModal } from './components/DeleteModal';
export { default as SideBar } from './components/SideBar';


// ── Hooks: Members ────────────────────────────────────────────────────────────
export {
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
} from './hooks/use-member';

