import { z } from 'zod';

export const relationTypeSchema = z.enum([
  'related',
  'extends',
  'rebuts',
  'uses_dataset',
  'survey_of',
]);

export const relatedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  year: z.number().nullable().optional(),
  doi: z.string().optional(),
  citationKey: z.string().optional(),
  relationType: relationTypeSchema.default('related'),
  symmetric: z.boolean().default(true),
  linkedAt: z.string().optional(),
});

export const relatedPaperItemSchema = relatedItemSchema;

export const linkRelationSchema = z.object({
  targetItemId: z.string().min(1, 'targetItemId is required'),
  relationType: relationTypeSchema.optional().default('related'),
});
