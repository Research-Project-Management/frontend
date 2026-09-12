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

// Canonical Aliases
export const coreStatsSchema = libraryStatsSchema;
export const coreOverviewSchema = libraryOverviewSchema;
export const coreFilterSchema = libraryFilterSchema;
export const corePaginationSchema = libraryPaginationSchema;
