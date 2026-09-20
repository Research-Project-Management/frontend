import { z } from 'zod';
import { itemSchema } from './items.types';

export const searchSortBySchema = z.enum([
  'relevance',
  'dateAdded',
  'year',
  'title',
]);

export const searchSortOrderSchema = z.enum(['asc', 'desc']);

export const searchDiscoveryParamsSchema = z.object({
  q: z.string().optional(),
  itemType: z.string().optional(),
  collectionId: z.string().optional(),
  tagId: z.string().optional(),
  yearFrom: z.number().int().optional(),
  yearTo: z.number().int().optional(),
  sortBy: searchSortBySchema.optional().default('relevance'),
  sortOrder: searchSortOrderSchema.optional().default('desc'),
  limit: z.number().int().optional().default(20),
  cursor: z.string().optional(),
});

export const searchFacetsSchema = z.object({
  itemTypes: z.record(z.string(), z.number()).optional().default({}),
  collections: z.record(z.string(), z.number()).optional().default({}),
  years: z.record(z.string(), z.number()).optional().default({}),
  tags: z.record(z.string(), z.number()).optional().default({}),
});

export const searchResponseSchema = z.object({
  items: z.array(itemSchema).default([]),
  total: z.number().optional().default(0),
  facets: searchFacetsSchema.optional(),
  meta: z
    .object({
      cursor: z.string().optional(),
      hasNextPage: z.boolean().default(false),
      totalCount: z.number().default(0),
    })
    .optional(),
  nextCursor: z.string().nullable().optional(),
});

export type SearchSortBy = z.infer<typeof searchSortBySchema>;
export type SearchSortOrder = z.infer<typeof searchSortOrderSchema>;
export type SearchDiscoveryParams = z.infer<typeof searchDiscoveryParamsSchema>;
export type SearchFacets = z.infer<typeof searchFacetsSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
