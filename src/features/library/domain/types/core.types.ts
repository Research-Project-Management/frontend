// Canonical Project Roles (4 roles: Owner, Coordinator, Contributor, Reviewer)
export type ProjectRole = 'owner' | 'coordinator' | 'contributor' | 'reviewer';

export type LibraryScopeType = 'user' | 'project';

/**
 * Canonical Library Permissions across all item, collection, and document actions.
 * Encapsulated capabilities derived from Scope and Project Module RBAC.
 */
export interface LibraryPermissions {
  readonly canRead: boolean;
  readonly canCreateItem: boolean;
  readonly canEditItem: boolean;
  readonly canDeleteItem: boolean;
  readonly canPurgeItem?: boolean;
  readonly canManageCollections: boolean;
  readonly canImport: boolean;
  readonly canExport: boolean;
}

/**
 * User Scope:
 * Personal library workspace for the user.
 * The user is always the Owner of this personal workspace, with full administration and edit permissions.
 * There is no concept of external members or role hierarchy in the User scope.
 */
export interface UserLibraryScope {
  type: 'user';
  id?: string; // Optional identifier ('user')
  name: string; // "Library"
  role?: 'owner'; // Optional alias for backward compatibility with legacy checks
  permissions?: Partial<LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
}

/**
 * Project Scope:
 * Collaborative library workspace within a project.
 * User permissions are strictly determined by the 4 standard project roles:
 * 'owner' | 'coordinator' | 'contributor' | 'reviewer' (no commenter or viewer).
 */
export interface ProjectLibraryScope {
  type: 'project';
  id: string; // Project UUID
  projectId?: string; // Canonical alias for Project UUID
  name: string; // Project title
  role?: ProjectRole;
  permissions?: Partial<LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
}

/**
 * Discriminated union of Library scopes.
 */
export type LibraryScope = UserLibraryScope | ProjectLibraryScope;
