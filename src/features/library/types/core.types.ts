import { z } from 'zod';

export const libraryStatsSchema = z.object({
  itemsCount: z.number().default(0),
  collectionsCount: z.number().default(0),
  tagsCount: z.number().default(0),
  notesCount: z.number().default(0),
  attachmentsCount: z.number().default(0),
  storageBytes: z.number().optional().default(0),
});

export const libraryTopTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  count: z.number().default(0),
});

export const libraryOverviewSchema = z.object({
  recentItems: z.array(z.record(z.string(), z.unknown())).default([]),
  unfiledCount: z.number().default(0),
  trashCount: z.number().default(0),
  starredCount: z.number().default(0),
  topTags: z.array(libraryTopTagSchema).default([]),
});

export const libraryFilterSchema = z.object({
  query: z.string().optional(),
  itemType: z.string().optional(),
  collectionId: z.string().optional(),
  tagId: z.string().optional(),
});

export const libraryPaginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const coreStatsSchema = libraryStatsSchema;
export const coreOverviewSchema = libraryOverviewSchema;
export const coreFilterSchema = libraryFilterSchema;
export const corePaginationSchema = libraryPaginationSchema;

export type LibraryStats = z.infer<typeof libraryStatsSchema>;
export type LibraryTopTag = z.infer<typeof libraryTopTagSchema>;
export type LibraryOverview = z.infer<typeof libraryOverviewSchema>;
export type LibraryFilter = z.infer<typeof libraryFilterSchema>;
export type LibraryPagination = z.infer<typeof libraryPaginationSchema>;

export type CoreStats = LibraryStats;
export type CoreOverview = LibraryOverview;

// ── Canonical Project Roles (4 roles: Owner, Coordinator, Contributor, Reviewer) ──
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
  readonly canManageCollections: boolean;
  readonly canImport: boolean;
  readonly canExport: boolean;
}

/**
 * User Scope:
 * Không gian cá nhân của người dùng.
 * Bản thân user luôn là Chủ sở hữu (Owner) của không gian này, có toàn quyền quản trị và chỉnh sửa.
 * Không tồn tại khái niệm member hay role trong User scope.
 */
export interface UserLibraryScope {
  type: 'user';
  id?: string; // Optional identifier ('user')
  name: string; // "Library"
  role?: 'owner'; // Optional alias for backward compatibility with legacy checks
}

/**
 * Project Scope:
 * Không gian thư viện cộng tác trong dự án.
 * Quyền hạn của user được xác định theo đúng 4 role chuẩn của dự án:
 * 'owner' | 'coordinator' | 'contributor' | 'reviewer' (không có commenter hay viewer).
 */
export interface ProjectLibraryScope {
  type: 'project';
  id: string; // Project UUID
  projectId?: string; // Canonical alias for Project UUID
  name: string; // Project title
  role: ProjectRole;
}

/**
 * Discriminated union of Library scopes.
 */
export type LibraryScope = UserLibraryScope | ProjectLibraryScope;
