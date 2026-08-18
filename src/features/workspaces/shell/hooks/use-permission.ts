'use client';

import { useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  hasWorkspaceRole,
  hasProjectRole,
  type WorkspaceRole,
  type ProjectRole,
} from '../types/iam.types';

export interface WorkspacePermissionResult {
  role: WorkspaceRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isViewer: boolean;
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canCreateProject: boolean;
  canDeleteWorkspace: boolean;
}

export interface ProjectPermissionResult {
  role: ProjectRole | null;
  isAdmin: boolean;
  isContributor: boolean;
  isCommenter: boolean;
  isViewer: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canManageMembers: boolean;
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  canComment: boolean;
}

/**
 * Hook to compute fine-grained workspace permissions for current authenticated user.
 */
export function useWorkspacePermission(
  workspace?: {
    ownerId?: string;
    members?: Array<{ userId: string; role: string }>;
  } | null,
): WorkspacePermissionResult {
  const { user } = useAuth();
  const userId = user?.id;

  return useMemo(() => {
    if (!userId || !workspace) {
      return {
        role: null,
        isOwner: false,
        isAdmin: false,
        isMember: false,
        isViewer: false,
        canManageWorkspace: false,
        canManageMembers: false,
        canCreateProject: false,
        canDeleteWorkspace: false,
      };
    }

    let role: WorkspaceRole = 'viewer';

    if (workspace.ownerId === userId) {
      role = 'owner';
    } else {
      const member = workspace.members?.find(
        (m) => m.userId === userId || (m as any).user?.id === userId,
      );
      if (member?.role) {
        role = member.role.toLowerCase() as WorkspaceRole;
      }
    }

    const isOwner = role === 'owner';
    const isAdmin = hasWorkspaceRole(role, 'admin');
    const isMember = hasWorkspaceRole(role, 'member');
    const isViewer = hasWorkspaceRole(role, 'viewer');

    return {
      role,
      isOwner,
      isAdmin,
      isMember,
      isViewer,
      canManageWorkspace: isAdmin,
      canManageMembers: isAdmin,
      canCreateProject: isMember,
      canDeleteWorkspace: isOwner,
    };
  }, [userId, workspace]);
}

/**
 * Hook to compute fine-grained project permissions for current authenticated user,
 * taking into account workspace-level Admin Escalation.
 */
export function useProjectPermission(
  project?: {
    createdBy?: string | { id?: string };
    members?: Array<{ userId?: string | { id?: string }; role: string }>;
  } | null,
  workspaceRole?: string | null,
): ProjectPermissionResult {
  const { user } = useAuth();
  const userId = user?.id;

  return useMemo(() => {
    if (!userId || !project) {
      return {
        role: null,
        isAdmin: false,
        isContributor: false,
        isCommenter: false,
        isViewer: false,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: false,
        canEditTask: false,
        canDeleteTask: false,
        canComment: false,
      };
    }

    let rawRole: ProjectRole = 'viewer';

    const member = project.members?.find((m) => {
      const mId = typeof m.userId === 'object' ? m.userId?.id : m.userId;
      return mId === userId;
    });

    if (member?.role) {
      rawRole = member.role.toLowerCase() as ProjectRole;
    }

    // Evaluate with Admin Escalation
    const isAdmin = hasProjectRole(rawRole, workspaceRole, 'admin');
    const isContributor = hasProjectRole(rawRole, workspaceRole, 'contributor');
    const isCommenter = hasProjectRole(rawRole, workspaceRole, 'commenter');
    const isViewer = hasProjectRole(rawRole, workspaceRole, 'viewer');

    return {
      role: isAdmin ? 'admin' : rawRole,
      isAdmin,
      isContributor,
      isCommenter,
      isViewer,
      canEditProject: isAdmin,
      canDeleteProject: isAdmin,
      canManageMembers: isAdmin,
      canCreateTask: isContributor,
      canEditTask: isContributor,
      canDeleteTask: isAdmin,
      canComment: isCommenter,
    };
  }, [userId, project, workspaceRole]);
}
