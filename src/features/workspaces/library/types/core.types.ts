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
