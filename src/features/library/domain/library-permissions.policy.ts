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
} from '@/features/library/types/core.types';

const CAP_PRIME = {
  READ: 2,
  CREATE: 3,
  EDIT: 5,
  DELETE: 7,
  PURGE: 11,
  COLLECTIONS: 13,
  IMPORT: 17,
  EXPORT: 19,
} as const;

const CAP_BIT = {
  READ: 1 << 0,
  CREATE: 1 << 1,
  EDIT: 1 << 2,
  DELETE: 1 << 3,
  PURGE: 1 << 4,
  COLLECTIONS: 1 << 5,
  IMPORT: 1 << 6,
  EXPORT: 1 << 7,
  ALL: 0xff,
} as const;

const ROLE_PRIME_PRODUCT: Readonly<Record<ProjectRole, number>> = {
  reviewer: CAP_PRIME.READ * CAP_PRIME.EXPORT,
  contributor:
    CAP_PRIME.READ *
    CAP_PRIME.CREATE *
    CAP_PRIME.EDIT *
    CAP_PRIME.COLLECTIONS *
    CAP_PRIME.IMPORT *
    CAP_PRIME.EXPORT,
  coordinator:
    CAP_PRIME.READ *
    CAP_PRIME.CREATE *
    CAP_PRIME.EDIT *
    CAP_PRIME.DELETE *
    CAP_PRIME.COLLECTIONS *
    CAP_PRIME.IMPORT *
    CAP_PRIME.EXPORT,
  owner:
    CAP_PRIME.READ *
    CAP_PRIME.CREATE *
    CAP_PRIME.EDIT *
    CAP_PRIME.DELETE *
    CAP_PRIME.PURGE *
    CAP_PRIME.COLLECTIONS *
    CAP_PRIME.IMPORT *
    CAP_PRIME.EXPORT,
};

const ROLE_MASK: Readonly<Record<ProjectRole, number>> = {
  reviewer: CAP_BIT.READ | CAP_BIT.EXPORT,
  contributor:
    CAP_BIT.READ |
    CAP_BIT.CREATE |
    CAP_BIT.EDIT |
    CAP_BIT.COLLECTIONS |
    CAP_BIT.IMPORT |
    CAP_BIT.EXPORT,
  coordinator:
    CAP_BIT.READ |
    CAP_BIT.CREATE |
    CAP_BIT.EDIT |
    CAP_BIT.DELETE |
    CAP_BIT.COLLECTIONS |
    CAP_BIT.IMPORT |
    CAP_BIT.EXPORT,
  owner: CAP_BIT.ALL,
};

const CAP_DESCRIPTORS: ReadonlyArray<readonly [keyof LibraryPermissions, number, number]> = [
  ['canRead', CAP_BIT.READ, CAP_PRIME.READ],
  ['canCreateItem', CAP_BIT.CREATE, CAP_PRIME.CREATE],
  ['canEditItem', CAP_BIT.EDIT, CAP_PRIME.EDIT],
  ['canDeleteItem', CAP_BIT.DELETE, CAP_PRIME.DELETE],
  ['canPurgeItem', CAP_BIT.PURGE, CAP_PRIME.PURGE],
  ['canManageCollections', CAP_BIT.COLLECTIONS, CAP_PRIME.COLLECTIONS],
  ['canImport', CAP_BIT.IMPORT, CAP_PRIME.IMPORT],
  ['canExport', CAP_BIT.EXPORT, CAP_PRIME.EXPORT],
];

function primeProductToPermissions(product: number, includePurge = true): LibraryPermissions {
  return {
    canRead: product % CAP_PRIME.READ === 0,
    canCreateItem: product % CAP_PRIME.CREATE === 0,
    canEditItem: product % CAP_PRIME.EDIT === 0,
    canDeleteItem: product % CAP_PRIME.DELETE === 0,
    ...(includePurge ? { canPurgeItem: product % CAP_PRIME.PURGE === 0 } : {}),
    canManageCollections: product % CAP_PRIME.COLLECTIONS === 0,
    canImport: product % CAP_PRIME.IMPORT === 0,
    canExport: product % CAP_PRIME.EXPORT === 0,
  };
}

function maskToPermissions(mask: number, includePurge = true): LibraryPermissions {
  return {
    canRead: (mask & CAP_BIT.READ) !== 0,
    canCreateItem: (mask & CAP_BIT.CREATE) !== 0,
    canEditItem: (mask & CAP_BIT.EDIT) !== 0,
    canDeleteItem: (mask & CAP_BIT.DELETE) !== 0,
    ...(includePurge ? { canPurgeItem: (mask & CAP_BIT.PURGE) !== 0 } : {}),
    canManageCollections: (mask & CAP_BIT.COLLECTIONS) !== 0,
    canImport: (mask & CAP_BIT.IMPORT) !== 0,
    canExport: (mask & CAP_BIT.EXPORT) !== 0,
  };
}

const USER_SOVEREIGN_PERMISSIONS: LibraryPermissions = primeProductToPermissions(
  ROLE_PRIME_PRODUCT.owner,
  false,
);

const TOKEN_GRANT_MASK: Readonly<Record<string, number>> = {
  '*': CAP_BIT.ALL,
  'library:*': CAP_BIT.ALL,
  'project:*': CAP_BIT.ALL,
  'library:read': CAP_BIT.READ | CAP_BIT.EXPORT,
  'library:view': CAP_BIT.READ,
  'project:read': CAP_BIT.READ,
  'library:create': CAP_BIT.CREATE | CAP_BIT.IMPORT,
  'library:add': CAP_BIT.CREATE,
  'library:write': CAP_BIT.CREATE | CAP_BIT.EDIT | CAP_BIT.COLLECTIONS | CAP_BIT.IMPORT,
  'library:edit': CAP_BIT.EDIT | CAP_BIT.COLLECTIONS,
  'library:update': CAP_BIT.EDIT,
  'library:delete': CAP_BIT.DELETE,
  'library:remove': CAP_BIT.DELETE,
  'library:trash': CAP_BIT.DELETE,
  'library:purge': CAP_BIT.PURGE,
  'library:manage_collections': CAP_BIT.COLLECTIONS,
  'library:collections': CAP_BIT.COLLECTIONS,
  'library:import': CAP_BIT.IMPORT,
  'library:export': CAP_BIT.EXPORT,
};

const OVERRIDE_KEY_BIT: Readonly<Record<string, number>> = {
  'library:read': CAP_BIT.READ,
  canread: CAP_BIT.READ,
  'library:create': CAP_BIT.CREATE,
  cancreateitem: CAP_BIT.CREATE,
  'library:edit': CAP_BIT.EDIT,
  'library:update': CAP_BIT.EDIT,
  canedititem: CAP_BIT.EDIT,
  'library:delete': CAP_BIT.DELETE,
  'library:trash': CAP_BIT.DELETE,
  candeleteitem: CAP_BIT.DELETE,
  'library:purge': CAP_BIT.PURGE,
  canpurgeitem: CAP_BIT.PURGE,
  'library:manage_collections': CAP_BIT.COLLECTIONS,
  'library:collections': CAP_BIT.COLLECTIONS,
  canmanagecollections: CAP_BIT.COLLECTIONS,
  'library:import': CAP_BIT.IMPORT,
  canimport: CAP_BIT.IMPORT,
  'library:export': CAP_BIT.EXPORT,
  canexport: CAP_BIT.EXPORT,
};

interface ServerPermissionPayload {
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
    return maskToPermissions(CAP_BIT.ALL, true);
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

  const baseMask = ROLE_MASK[normalizedRole] ?? ROLE_MASK.reviewer;

  const hasPermKeys = (obj: object): boolean =>
    CAP_DESCRIPTORS.some(([key]) => key in obj);

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
            hasPermKeys(effectiveServerData)
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

  let mask = baseMask;

  // 1. Apply Backend token array (`effectivePermissions` or `permissions: string[]`) via bitmask union
  if (Array.isArray(rawEffectiveTokens) && rawEffectiveTokens.length > 0) {
    let tokenMask = baseMask & (CAP_BIT.READ | CAP_BIT.EXPORT);
    for (const rawToken of rawEffectiveTokens) {
      const token = String(rawToken).trim().toLowerCase();
      tokenMask |= TOKEN_GRANT_MASK[token] ?? 0;
      if (normalizedRole === 'owner' && token === 'library:delete') {
        tokenMask |= CAP_BIT.PURGE;
      }
    }
    mask = tokenMask;
  }

  // 2. Apply explicit boolean object (`permissions: Partial<LibraryPermissions>`)
  if (rawPerms && !Array.isArray(rawPerms) && typeof rawPerms === 'object') {
    const permRecord = rawPerms as Partial<LibraryPermissions>;
    for (const [key, bit] of CAP_DESCRIPTORS) {
      const flag = permRecord[key];
      if (typeof flag === 'boolean') {
        mask = flag ? mask | bit : mask & ~bit;
      }
    }
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
    for (const [rawKey, allowed] of Object.entries(overrides)) {
      const bit = OVERRIDE_KEY_BIT[rawKey.trim().toLowerCase()];
      if (bit && typeof allowed === 'boolean') {
        mask = allowed ? mask | bit : mask & ~bit;
      }
    }
  }

  return maskToPermissions(mask, true);
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

  return primeProductToPermissions(
    ROLE_PRIME_PRODUCT[normalizedRole] ?? ROLE_PRIME_PRODUCT.reviewer,
    false,
  );
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

/**
 * Tell, Don't Ask Policy: Determines whether an item ID represents a persisted
 * server-side library record rather than an optimistic/provisional upload placeholder.
 */
export function isPersistedItemId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  return !trimmed.startsWith('temp-') && !trimmed.startsWith('provisional-');
}

/**
 * Tell, Don't Ask Policy: Determines whether a library item is fully persisted
 * and ready for mutating operations (not actively uploading/processing or provisional).
 */
export function isPersistedLibraryItem(
  item?: { id: string; _isProcessing?: boolean } | null,
): boolean {
  if (!item) return false;
  if (item._isProcessing) return false;
  return isPersistedItemId(item.id);
}

