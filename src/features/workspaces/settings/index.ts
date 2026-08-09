// ── settings/index.ts ─────────────────────────────────────────────────────────
// Settings feature public API.
// Owns: workspace member management, roles, and settings UI components.

// ── Components ────────────────────────────────────────────────────────────────
export { default as DeleteModal } from './components/general/components/deleteModal';

// ── Hooks: Roles ──────────────────────────────────────────────────────────────
export {
  useRoles,
  useRole,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useDuplicateRole,
} from './hooks/use-roles';

// ── Hooks: Members ────────────────────────────────────────────────────────────
export {
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
} from './hooks/use-workspace-members';

export { useFilteredMembers } from './hooks/use-filtered-members';
export { useMemberActions } from './hooks/use-member-actions';
