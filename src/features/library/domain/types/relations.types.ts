import { z } from 'zod';

export const relationTypeSchema = z.enum([
  'related',
  'cites',
  'citedBy',
  'isCitedBy',
  'cited_by',
  'supplementTo',
  'supplement_to',
  'isSupplementedBy',
  'supplements',
  'partOf',
  'part_of',
  'continues',
  'isContinuedBy',
  'continued_by',
  'replicates',
  'extends',
  'is_preprint_of',
  'is_published_version_of',
  'is_translation_of',
  'rebuts',
  'uses_dataset',
  'survey_of',
]);

export const RelationTypeSchema = relationTypeSchema;

const LEGACY_RELATION_TYPE_MAP: Record<string, z.infer<typeof relationTypeSchema>> = {
  cited_by: 'isCitedBy',
  supplement_to: 'supplementTo',
  part_of: 'partOf',
  continued_by: 'isContinuedBy',
};

export function normalizeRelationType(
  raw?: unknown,
): z.infer<typeof relationTypeSchema> {
  if (typeof raw !== 'string' || !raw.trim()) return 'related';
  const trimmed = raw.trim();
  if (trimmed in LEGACY_RELATION_TYPE_MAP) {
    return LEGACY_RELATION_TYPE_MAP[trimmed];
  }
  const parsed = relationTypeSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : 'related';
}

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

export const linkRelationSchema = z.object({
  targetItemId: z.string().optional(),
  targetItemIds: z.array(z.string()).optional(),
  relationType: relationTypeSchema.optional().default('related'),
  note: z.string().optional(),
});

export type RelationType = z.infer<typeof relationTypeSchema>;
export type RelatedItem = z.infer<typeof relatedItemSchema>;
export type LinkRelationInput = z.infer<typeof linkRelationSchema>;
