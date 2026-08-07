/**
 * shared/utils/roles.ts
 *
 * Role display utilities — used across multiple features
 * (settings/member, projects/team, projects/overview).
 *
 * Keep domain logic (permission checks) in the respective feature.
 * This file only handles UI representation of role values.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'owner' | 'admin' | 'member' | 'viewer' | string;

// ─── Display Name ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

/**
 * Convert a role string to a human-readable label.
 * @example getRoleName('admin') → "Admin"
 */
export const getRoleName = (role: Role): string =>
  ROLE_LABELS[role.toLowerCase()] ?? capitalize(role);

// ─── Badge Color ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-600',
};

/**
 * Return Tailwind CSS classes for a role badge.
 * @example getRoleColor('owner') → "bg-purple-100 text-purple-700"
 */
export const getRoleColor = (role: Role): string =>
  ROLE_COLORS[role.toLowerCase()] ?? 'bg-gray-100 text-gray-600';

// ─── Internal ─────────────────────────────────────────────────────────────────

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
