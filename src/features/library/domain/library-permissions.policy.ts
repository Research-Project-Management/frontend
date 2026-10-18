/**
 * Pure Domain Policy: Library Scope & Permissions Resolution
 *
 * Rules:
 * 1. Backend Authority: When the Backend returns explicit `permissions` or `effectivePermissions`
 *    (including member-level `permissionOverrides` such as `library:delete`), those authoritative
 *    capabilities always take precedence over static role defaults.
 * 2. User Library: The user is the sovereign owner. Full unrestricted capabilities.
 * 3. Project Library: Governed by the Project Module RBAC with 4 canonical roles:
 *    - 'owner': Full management + permanent purge (`canPurgeItem: true`).
 *    - 'coordinator': Full management, create, edit, delete, import, export, manage collections (`canPurgeItem: false`).
 *    - 'contributor': Create, edit, upload, annotate, export, manage collections (`canDeleteItem: false`, `canPurgeItem: false`).
 *    - 'reviewer': Read-only viewing, annotating, and exporting (no create, edit, delete, import).
 */

import type {
  LibraryScope,
  LibraryPermissions,
  LibraryScopeType,
  ProjectRole,
} from '@/features/library/domain/types/core.types';

const USER_SOVEREIGN_PERMISSIONS: LibraryPermissions = {
  canRead: true,
  canCreateItem: true,
  canEditItem: true,
  canDeleteItem: true,
  canManageCollections: true,
  canImport: true,
  canExport: true,
};

export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, LibraryPermissions> = {
  owner: {
    canRead: true,
    canCreateItem: true,
    canEditItem: true,
    canDeleteItem: true,
    canPurgeItem: true,
    canManageCollections: true,
    canImport: true,
    canExport: true,
  },
  coordinator: {
    canRead: true,
    canCreateItem: true,
    canEditItem: true,
    canDeleteItem: true,
    canPurgeItem: false,
    canManageCollections: true,
    canImport: true,
    canExport: true,
  },
  contributor: {
    canRead: true,
    canCreateItem: true,
    canEditItem: true,
    canDeleteItem: false,
    canPurgeItem: false,
    canManageCollections: true,
    canImport: true,
    canExport: true,
  },
  reviewer: {
    canRead: true,
    canCreateItem: false,
    canEditItem: false,
    canDeleteItem: false,
    canPurgeItem: false,
    canManageCollections: false,
    canImport: false,
    canExport: true,
  },
};

export interface ServerPermissionPayload {
  scopeType?: 'user' | 'project' | string;
  role?: ProjectRole | string | null;
  yourRole?: ProjectRole | string | null;
  permissions?: Partial<LibraryPermissions> | string[] | Record<string, unknown> | null;
  effectivePermissions?: string[] | null;
  permissionOverrides?: Record<string, boolean> | null;
}

/**
 * Maps Backend granular permission tokens (e.g. `library:read`, `library:create`, `library:edit`,
 * `library:delete`, `library:purge`, `library:manage_collections`, `library:import`, `library:export`)
 * and/or partial `LibraryPermissions` flags onto the canonical `LibraryPermissions` object.
 */
export function resolveEffectiveLibraryPermissions(
  scopeOrType: LibraryScope | ServerPermissionPayload | LibraryScopeType | string | undefined | null,
  serverData?: ServerPermissionPayload | Partial<LibraryPermissions> | string[] | null,
  fallbackRole?: ProjectRole | string | null,
): LibraryPermissions {
  const isScopeObject =
    typeof scopeOrType === 'object' &&
    scopeOrType !== null &&
    'type' in scopeOrType;

  const isPayloadObject =
    typeof scopeOrType === 'object' &&
    scopeOrType !== null &&
    !isScopeObject;

  const effectiveServerData =
    serverData ?? (isPayloadObject ? (scopeOrType as ServerPermissionPayload) : null);

  const scopeType = isScopeObject
    ? (scopeOrType as LibraryScope).type
    : isPayloadObject && 'scopeType' in scopeOrType && scopeOrType.scopeType
      ? String(scopeOrType.scopeType).trim().toLowerCase()
      : String(scopeOrType || 'user')
          .trim()
          .toLowerCase();

  if (scopeType === 'user' || scopeType === 'personal') {
    return { ...USER_SOVEREIGN_PERMISSIONS, canPurgeItem: true };
  }

  const rawRole =
    (effectiveServerData &&
    !Array.isArray(effectiveServerData) &&
    typeof effectiveServerData === 'object' &&
    ('role' in effectiveServerData || 'yourRole' in effectiveServerData)
      ? effectiveServerData.role || effectiveServerData.yourRole
      : undefined) ??
    (isScopeObject ? (scopeOrType as LibraryScope).role : fallbackRole);

  const normalizedRole = String(rawRole || 'reviewer')
    .trim()
    .toLowerCase() as ProjectRole;

  const basePermissions: LibraryPermissions = {
    ...(PROJECT_ROLE_PERMISSIONS[normalizedRole] ?? PROJECT_ROLE_PERMISSIONS.reviewer),
  };

  // Extract any server-provided permissions from either effectiveServerData or scopeOrType
  const rawPerms =
    Array.isArray(effectiveServerData)
      ? effectiveServerData
      : effectiveServerData &&
          typeof effectiveServerData === 'object' &&
          'permissions' in effectiveServerData &&
          effectiveServerData.permissions
        ? effectiveServerData.permissions
        : effectiveServerData &&
            typeof effectiveServerData === 'object' &&
            ('canRead' in effectiveServerData ||
              'canCreateItem' in effectiveServerData ||
              'canEditItem' in effectiveServerData ||
              'canDeleteItem' in effectiveServerData ||
              'canPurgeItem' in effectiveServerData ||
              'canManageCollections' in effectiveServerData ||
              'canImport' in effectiveServerData ||
              'canExport' in effectiveServerData)
          ? (effectiveServerData as Partial<LibraryPermissions>)
          : isScopeObject && (scopeOrType as LibraryScope).permissions
            ? (scopeOrType as LibraryScope).permissions
            : null;

  const rawEffectiveTokens =
    Array.isArray(effectiveServerData)
      ? effectiveServerData
      : effectiveServerData &&
          typeof effectiveServerData === 'object' &&
          'effectivePermissions' in effectiveServerData &&
          Array.isArray(effectiveServerData.effectivePermissions)
        ? effectiveServerData.effectivePermissions
        : Array.isArray(rawPerms)
          ? rawPerms
          : isScopeObject && Array.isArray((scopeOrType as LibraryScope).effectivePermissions)
            ? (scopeOrType as LibraryScope).effectivePermissions
            : null;

  let resolved: LibraryPermissions = { ...basePermissions };

  // 1. Apply Backend token array (`effectivePermissions` or `permissions: string[]`)
  if (Array.isArray(rawEffectiveTokens) && rawEffectiveTokens.length > 0) {
    const tokenSet = new Set(rawEffectiveTokens.map((t) => String(t).trim().toLowerCase()));
    const hasWildcard = tokenSet.has('*') || tokenSet.has('library:*') || tokenSet.has('project:*');
    resolved = {
      canRead:
        hasWildcard ||
        tokenSet.has('library:read') ||
        tokenSet.has('library:view') ||
        tokenSet.has('project:read') ||
        basePermissions.canRead,
      canCreateItem:
        hasWildcard ||
        tokenSet.has('library:create') ||
        tokenSet.has('library:write') ||
        tokenSet.has('library:add'),
      canEditItem:
        hasWildcard ||
        tokenSet.has('library:edit') ||
        tokenSet.has('library:update') ||
        tokenSet.has('library:write'),
      canDeleteItem:
        hasWildcard ||
        tokenSet.has('library:delete') ||
        tokenSet.has('library:remove') ||
        tokenSet.has('library:trash'),
      canPurgeItem:
        hasWildcard ||
        tokenSet.has('library:purge') ||
        (normalizedRole === 'owner' && tokenSet.has('library:delete')),
      canManageCollections:
        hasWildcard ||
        tokenSet.has('library:manage_collections') ||
        tokenSet.has('library:collections') ||
        tokenSet.has('library:write') ||
        tokenSet.has('library:edit'),
      canImport:
        hasWildcard ||
        tokenSet.has('library:import') ||
        tokenSet.has('library:create') ||
        tokenSet.has('library:write'),
      canExport:
        hasWildcard ||
        tokenSet.has('library:export') ||
        tokenSet.has('library:read') ||
        basePermissions.canExport,
    };
  }

  // 2. Apply explicit boolean object (`permissions: Partial<LibraryPermissions>`)
  if (rawPerms && !Array.isArray(rawPerms) && typeof rawPerms === 'object') {
    const permRecord = rawPerms as Partial<LibraryPermissions>;
    resolved = {
      canRead: typeof permRecord.canRead === 'boolean' ? permRecord.canRead : resolved.canRead,
      canCreateItem: typeof permRecord.canCreateItem === 'boolean' ? permRecord.canCreateItem : resolved.canCreateItem,
      canEditItem: typeof permRecord.canEditItem === 'boolean' ? permRecord.canEditItem : resolved.canEditItem,
      canDeleteItem: typeof permRecord.canDeleteItem === 'boolean' ? permRecord.canDeleteItem : resolved.canDeleteItem,
      canPurgeItem: typeof permRecord.canPurgeItem === 'boolean' ? permRecord.canPurgeItem : resolved.canPurgeItem,
      canManageCollections:
        typeof permRecord.canManageCollections === 'boolean'
          ? permRecord.canManageCollections
          : resolved.canManageCollections,
      canImport: typeof permRecord.canImport === 'boolean' ? permRecord.canImport : resolved.canImport,
      canExport: typeof permRecord.canExport === 'boolean' ? permRecord.canExport : resolved.canExport,
    };
  }

  // 3. Apply explicit `permissionOverrides` map from Backend if provided
  const overrides =
    effectiveServerData &&
    !Array.isArray(effectiveServerData) &&
    typeof effectiveServerData === 'object' &&
    'permissionOverrides' in effectiveServerData
      ? effectiveServerData.permissionOverrides
      : null;
  if (overrides && typeof overrides === 'object') {
    const next = { ...resolved };
    for (const [rawKey, allowed] of Object.entries(overrides)) {
      if (typeof allowed !== 'boolean') continue;
      const key = rawKey.trim().toLowerCase();
      if (key === 'library:read' || key === 'canread') next.canRead = allowed;
      if (key === 'library:create' || key === 'cancreateitem') next.canCreateItem = allowed;
      if (key === 'library:edit' || key === 'library:update' || key === 'canedititem') next.canEditItem = allowed;
      if (key === 'library:delete' || key === 'library:trash' || key === 'candeleteitem') next.canDeleteItem = allowed;
      if (key === 'library:purge' || key === 'canpurgeitem') next.canPurgeItem = allowed;
      if (key === 'library:manage_collections' || key === 'library:collections' || key === 'canmanagecollections') {
        next.canManageCollections = allowed;
      }
      if (key === 'library:import' || key === 'canimport') next.canImport = allowed;
      if (key === 'library:export' || key === 'canexport') next.canExport = allowed;
    }
    resolved = next;
  }

  return resolved;
}

export function getLibraryPermissions(
  scopeOrType: LibraryScope | LibraryScopeType | string,
  userRoleOrServerPerms?: ProjectRole | string | ServerPermissionPayload | Partial<LibraryPermissions> | null,
): LibraryPermissions {
  const isScopeObject = typeof scopeOrType === 'object' && scopeOrType !== null;
  const scopeType = isScopeObject
    ? scopeOrType.type
    : String(scopeOrType || 'user')
        .trim()
        .toLowerCase();

  if (scopeType === 'user' || scopeType === 'personal') {
    return { ...USER_SOVEREIGN_PERMISSIONS };
  }

  // If caller passed server permissions or scope carries server permissions, resolve them first
  if (
    (userRoleOrServerPerms && typeof userRoleOrServerPerms === 'object') ||
    (isScopeObject && (scopeOrType.permissions || scopeOrType.effectivePermissions))
  ) {
    return resolveEffectiveLibraryPermissions(
      scopeOrType,
      typeof userRoleOrServerPerms === 'object' ? userRoleOrServerPerms : null,
      typeof userRoleOrServerPerms === 'string' ? userRoleOrServerPerms : null,
    );
  }

  const rawRole = isScopeObject
    ? scopeOrType.role
    : typeof userRoleOrServerPerms === 'string'
      ? userRoleOrServerPerms
      : undefined;
  const normalizedRole = String(rawRole || 'reviewer')
    .trim()
    .toLowerCase() as ProjectRole;
  const permissions =
    PROJECT_ROLE_PERMISSIONS[normalizedRole] ?? PROJECT_ROLE_PERMISSIONS.reviewer;

  const result: LibraryPermissions = {
    canRead: permissions.canRead,
    canCreateItem: permissions.canCreateItem,
    canEditItem: permissions.canEditItem,
    canDeleteItem: permissions.canDeleteItem,
    canManageCollections: permissions.canManageCollections,
    canImport: permissions.canImport,
    canExport: permissions.canExport,
  };
  return result;
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
