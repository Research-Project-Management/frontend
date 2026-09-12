import { z } from 'zod';
import {
  libraryStatsSchema,
  libraryTopTagSchema,
  libraryOverviewSchema,
  libraryFilterSchema,
  libraryPaginationSchema,
} from '../schemas/core.schema';

export type LibraryStats = z.infer<typeof libraryStatsSchema>;
export type LibraryTopTag = z.infer<typeof libraryTopTagSchema>;
export type LibraryOverview = z.infer<typeof libraryOverviewSchema>;
export type LibraryFilter = z.infer<typeof libraryFilterSchema>;
export type LibraryPagination = z.infer<typeof libraryPaginationSchema>;

// Canonical Aliases
export type CoreStats = LibraryStats;
export type CoreOverview = LibraryOverview;

// ── Collaborative Dual-Scope Types (My Library vs Project Libraries) ─────────
export type LibraryScopeType = 'personal' | 'project';

export interface LibraryScope {
  type: LibraryScopeType;
  id: string; // 'user' (nếu là personal) hoặc projectId (UUID)
  name: string; // "My Library" hoặc tên Đề tài / Dự án
  role?: 'owner' | 'contributor' | 'commenter' | 'viewer';
}

