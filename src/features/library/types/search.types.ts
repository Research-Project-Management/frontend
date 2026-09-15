import { z } from 'zod';
import {
  searchSortBySchema,
  searchSortOrderSchema,
  searchDiscoveryParamsSchema,
  searchFacetsSchema,
  searchResponseSchema,
} from '../schemas/search.schema';

export type SearchSortBy = z.infer<typeof searchSortBySchema>;
export type SearchSortOrder = z.infer<typeof searchSortOrderSchema>;
export type SearchDiscoveryParams = z.infer<typeof searchDiscoveryParamsSchema>;
export type SearchFacets = z.infer<typeof searchFacetsSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
