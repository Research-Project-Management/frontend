import { z } from 'zod';
import { itemSchema } from './items.types';

export const searchSortBySchema = z.enum([
  'relevance',
  'dateAdded',
  'createdAt',
  'year',
  'title',
]);

export const searchSortOrderSchema = z.enum(['asc', 'desc']);

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
      pageCount: z.number().optional(),
      totalCount: z.number().optional(),
    })
    .transform((m) => {
      if (!m) return m;
      return {
        ...m,
        totalCount: m.totalCount ?? m.pageCount ?? 0,
      };
    })
    .optional(),
  nextCursor: z.string().nullable().optional(),
});

export type SearchSortBy = z.infer<typeof searchSortBySchema>;
export type SearchSortOrder = z.infer<typeof searchSortOrderSchema>;
export type SearchFacets = z.infer<typeof searchFacetsSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
