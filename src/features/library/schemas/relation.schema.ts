import { z } from 'zod';

export const relationTypeSchema = z.enum([
  'related',
  'cites',
  'cited_by',
  'replicates',
  'extends',
  'is_preprint_of',
  'is_published_version_of',
  'is_translation_of',
  'supplements',
  'rebuts',
  'uses_dataset',
  'survey_of',
]);

export const relatedItemSchema = z.object({
  id: z.string(),
  relationId: z.string().optional(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  year: z.number().nullable().optional(),
  doi: z.string().optional(),
  itemType: z.string().optional(),
  citationKey: z.string().optional(),
  relationType: relationTypeSchema.default('related'),
  direction: z.enum(['outgoing', 'incoming']).optional(),
  description: z.string().optional(),
  symmetric: z.boolean().default(true),
  linkedAt: z.string().optional(),
});

export const relatedPaperItemSchema = relatedItemSchema;

export const linkRelationSchema = z.object({
  targetItemId: z.string().optional(),
  targetItemIds: z.array(z.string()).optional(),
  relationType: relationTypeSchema.optional().default('related'),
  note: z.string().optional(),
});

