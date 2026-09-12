import { z } from 'zod';
import { itemSchema } from './item.schema';

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
  itemTypes: z.record(z.string(), z.number()).default({}),
  years: z.record(z.string(), z.number()).default({}),
  tags: z.record(z.string(), z.number()).default({}),
});

export const searchResponseSchema = z.object({
  items: z.array(itemSchema).default([]),
  total: z.number().default(0),
  facets: searchFacetsSchema.optional(),
  nextCursor: z.string().nullable().optional(),
});
