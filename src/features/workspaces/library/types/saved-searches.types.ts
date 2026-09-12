import { z } from 'zod';
import {
  savedSearchFieldSchema,
  savedSearchOperatorSchema,
  savedSearchConditionSchema,
  savedSearchConditionGroupSchema,
  savedSearchSchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  savedSearchResultsResponseSchema,
  savedSearchPreviewResponseSchema,
  SavedSearchCondition,
  SavedSearchConditionGroup,
} from '../schemas/saved-search.schema';

export type SavedSearchField = z.infer<typeof savedSearchFieldSchema>;
export type SavedSearchOperator = z.infer<typeof savedSearchOperatorSchema>;
export type { SavedSearchCondition, SavedSearchConditionGroup };

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type SavedSearchResultsResponse = z.infer<
  typeof savedSearchResultsResponseSchema
>;
export type SavedSearchPreviewResponse = z.infer<
  typeof savedSearchPreviewResponseSchema
>;
