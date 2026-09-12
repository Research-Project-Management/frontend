import { z } from 'zod';

export const retractionNatureSchema = z.enum([
  'retraction',
  'expression_of_concern',
  'correction',
  'manual',
]);

export const retractionDetailsSchema = z.object({
  nature: retractionNatureSchema,
  reason: z.string().optional(),
  noticeUrl: z.string().optional(),
  date: z.string().optional(),
  source: z.enum(['crossref', 'openalex', 'retraction_watch', 'manual']),
});

export const flagRetractionInputSchema = z.object({
  nature: retractionNatureSchema.optional().default('manual'),
  reason: z.string().optional(),
  noticeUrl: z.string().optional(),
  date: z.string().optional(),
});

export const retractionStatsSchema = z.object({
  totalItems: z.number(),
  checkedItems: z.number(),
  retractedCount: z.number(),
  expressionsOfConcernCount: z.number(),
  manualCount: z.number(),
});

export type RetractionNature = z.infer<typeof retractionNatureSchema>;
export type RetractionDetails = z.infer<typeof retractionDetailsSchema>;
export type FlagRetractionInput = z.infer<typeof flagRetractionInputSchema>;
export type RetractionStats = z.infer<typeof retractionStatsSchema>;
