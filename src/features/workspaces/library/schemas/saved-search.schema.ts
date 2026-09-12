import { z } from 'zod';
import { itemSchema } from './item.schema';

export const savedSearchFieldSchema = z.enum([
  'title',
  'abstract',
  'creator',
  'year',
  'itemType',
  'tag',
  'collection',
  'readStatus',
  'rating',
  'doi',
  'isbn',
  'hasAttachment',
  'dateAdded',
  'publicationTitle',
]);

export const savedSearchOperatorSchema = z.enum([
  'is',
  'isNot',
  'contains',
  'doesNotContain',
  'beginsWith',
  'endsWith',
  'isGreaterThan',
  'isLessThan',
  'isBetween',
  'isPresent',
  'isAbsent',
]);

export const savedSearchConditionSchema = z.object({
  field: savedSearchFieldSchema,
  operator: savedSearchOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional(),
});

export type SavedSearchCondition = z.infer<typeof savedSearchConditionSchema>;

export interface SavedSearchConditionGroup {
  conjunction: 'AND' | 'OR';
  conditions: (SavedSearchCondition | SavedSearchConditionGroup)[];
}

export const savedSearchConditionGroupSchema: z.ZodType<SavedSearchConditionGroup> = z.lazy(() =>
  z.object({
    conjunction: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(
      z.union([savedSearchConditionSchema, savedSearchConditionGroupSchema]),
    ),
  }),
);

export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  conditions: savedSearchConditionGroupSchema,
  conjunction: z.enum(['AND', 'OR']).default('AND'),
  sortBy: z.enum(['dateAdded', 'year', 'title', 'creator']).optional().default('dateAdded'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  isPinned: z.boolean().optional().default(false),
  cachedCount: z.number().nullable().optional().default(0),
  lastEvaluatedAt: z.string().datetime().nullable().optional(),
  workspaceId: z.string(),
  creatorId: z.string(),
  creator: z
    .object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().nullable().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createSavedSearchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  conditions: savedSearchConditionGroupSchema,
  conjunction: z.enum(['AND', 'OR']).optional().default('AND'),
  sortBy: z.enum(['dateAdded', 'year', 'title', 'creator']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isPinned: z.boolean().optional(),
});

export const updateSavedSearchSchema = createSavedSearchSchema.partial();

export const savedSearchResultsResponseSchema = z.object({
  savedSearch: savedSearchSchema,
  items: z.array(itemSchema),
  meta: z.object({
    totalCount: z.number(),
    cursor: z.string().optional(),
    hasNextPage: z.boolean(),
  }),
});

export const savedSearchPreviewResponseSchema = z.object({
  count: z.number(),
  sampleItems: z.array(itemSchema),
});

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type SavedSearchResultsResponse = z.infer<typeof savedSearchResultsResponseSchema>;
export type SavedSearchPreviewResponse = z.infer<typeof savedSearchPreviewResponseSchema>;
export type SavedSearchField = z.infer<typeof savedSearchFieldSchema>;
export type SavedSearchOperator = z.infer<typeof savedSearchOperatorSchema>;
