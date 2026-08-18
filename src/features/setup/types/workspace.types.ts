/**
 * workspace.types.ts
 * Domain types for the setup/workspace feature.
 * Derived from backend Mongoose schema (workspace.schema.js).
 */

// ─── Sub-types ────────────────────────────────────────────────────────────────

/** Populated user shape returned when a member is populated. */
export type WorkspaceMemberUser = {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
};

// ─── WorkspaceMember ──────────────────────────────────────────────────────────

/**
 * A workspace member entry as returned by the API.
 * `userId` and `role` can be either an ID string (un-populated) or a full object (populated).
 */
export type WorkspaceMember = {
  userId: string | WorkspaceMemberUser;
  role: 'owner' | 'admin' | 'member' | 'viewer' | string;
  joinedAt: string;
};

// ─── Workspace ────────────────────────────────────────────────────────────────

export type Workspace = {
  id: string;
  name: string;
  url: string;
  avatar: string;
  companySize?: string;
  inviteCode?: string;
  createdById?: string;
  settings?: Record<string, unknown>;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
};

// ─── Role ─────────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
