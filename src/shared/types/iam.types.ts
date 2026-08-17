/**
 * iam.types.ts
 * Fine-grained 8-Role IAM System for Frontend (aligned with Backend Prisma Schema).
 */

// ─── 1. Workspace Roles & Hierarchy ──────────────────────────────────────────

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

// ─── 2. Project Roles & Hierarchy ────────────────────────────────────────────

export const PROJECT_ROLES = ['admin', 'contributor', 'commenter', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ROLE_HIERARCHY: Record<ProjectRole, number> = {
  admin: 4,
  contributor: 3,
  commenter: 2,
  viewer: 1,
};

// ─── 3. Permission Checks with Admin Escalation ──────────────────────────────

/**
 * Check if user's workspace role satisfies required minimum role.
 */
export function hasWorkspaceRole(
  userRole: string | null | undefined,
  requiredRole: WorkspaceRole,
): boolean {
  if (!userRole) return false;
  const normalized = userRole.toLowerCase() as WorkspaceRole;
  const userLevel = WORKSPACE_ROLE_HIERARCHY[normalized] ?? 0;
  const requiredLevel = WORKSPACE_ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if user has project-level permission, applying Admin Escalation Rule:
 * (Workspace Owner & Workspace Admin automatically inherit Project Admin access).
 */
export function hasProjectRole(
  projectRole: string | null | undefined,
  workspaceRole: string | null | undefined,
  requiredRole: ProjectRole,
): boolean {
  // Escalation rule: Workspace Owner / Admin gets instant Project Admin
  if (hasWorkspaceRole(workspaceRole, 'admin')) {
    return true;
  }

  if (!projectRole) return false;
  const normalized = projectRole.toLowerCase() as ProjectRole;
  const userLevel = PROJECT_ROLE_HIERARCHY[normalized] ?? 0;
  const requiredLevel = PROJECT_ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}
