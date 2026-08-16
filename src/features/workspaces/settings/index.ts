// ── settings/index.ts ─────────────────────────────────────────────────────────
// Settings feature public API.
// Owns: workspace member management, roles, and settings UI components.

// ── Components ────────────────────────────────────────────────────────────────
export { default as DeleteModal } from './components/DeleteModal';
export { default as SideBar } from './components/SideBar';
export { default as TopBar } from './components/TopBar';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export {
  useMember,
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
} from './hooks/use-member';
export { useGeneral } from './hooks/use-general';
export * from './types/member.types';
