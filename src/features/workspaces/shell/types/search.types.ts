import { z } from 'zod';
import {
  SearchResultTypeSchema,
  SearchResultSchema,
  SearchResponseSchema,
} from '../schemas/search.schema';

export type SearchResultType = z.infer<typeof SearchResultTypeSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
