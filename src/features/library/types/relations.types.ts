import { z } from 'zod';
import {
  relationTypeSchema,
  relatedItemSchema,
  linkRelationSchema,
} from '../schemas/relation.schema';

export type RelationType = z.infer<typeof relationTypeSchema>;
export type RelatedItem = z.infer<typeof relatedItemSchema>;
/** @deprecated Use RelatedItem */
export type RelatedPaperItem = RelatedItem;
export type LinkRelationInput = z.infer<typeof linkRelationSchema>;
