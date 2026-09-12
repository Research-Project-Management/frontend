import { z } from 'zod';
import {
  tagSchema,
  createTagSchema,
  updateTagSchema,
  mergeTagsSchema,
} from '../schemas/tag.schema';

export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = Tag;

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type MergeTagsInput = z.infer<typeof mergeTagsSchema>;
