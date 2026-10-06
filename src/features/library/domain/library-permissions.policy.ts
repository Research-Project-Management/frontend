/**
 * Pure Domain Policy: Library Scope & Permissions Resolution
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 *
 * Rules:
 * 1. User Library: The user is the sovereign owner. Full unrestricted capabilities.
 * 2. Project Library: Governed by the Project Module RBAC with 4 canonical roles:
 *    - 'owner' | 'coordinator': Full management, create, edit, delete, import, export, manage collections.
 *    - 'contributor': Create, edit, upload, annotate, export, manage collections (cannot permanently purge).
 *    - 'reviewer': Read-only viewing, annotating, and exporting (no create, edit, delete, import).
 */

import type { LibraryScope, LibraryPermissions, ProjectRole } from '../types/core.types';

export function getLibraryPermissions(scope: LibraryScope): LibraryPermissions {
  if (scope.type === 'user') {
    return {
      canRead: true,
      canCreateItem: true,
      canEditItem: true,
      canDeleteItem: true,
      canManageCollections: true,
      canImport: true,
      canExport: true,
    };
  }

  const role: ProjectRole = scope.role;
  const isReviewer = role === 'reviewer';
  const isManagement = role === 'owner' || role === 'coordinator';

  return {
    canRead: true,
    canCreateItem: !isReviewer,
    canEditItem: !isReviewer,
    canDeleteItem: isManagement,
    canManageCollections: !isReviewer,
    canImport: !isReviewer,
    canExport: true,
  };
}

export function getScopeTarget(scope: LibraryScope): {
  isProject: boolean;
  projectId?: string;
  itemsApiUrl: string;
} {
  if (scope.type === 'project') {
    const projectId = scope.projectId || scope.id;
    return {
      isProject: true,
      projectId,
      itemsApiUrl: `/api/v1/projects/${encodeURIComponent(projectId)}/library/items`,
    };
  }
  return {
    isProject: false,
    projectId: undefined,
    itemsApiUrl: `/api/v1/library/items`,
  };
}
