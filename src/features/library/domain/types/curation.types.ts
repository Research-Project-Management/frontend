import { z } from 'zod';
import { itemSchema } from './items.types';

export const duplicateGroupSchema = z.object({
  matchType: z.enum(['DOI', 'TITLE_AUTHOR_YEAR']),
  confidence: z.enum(['high', 'medium']),
  key: z.string(),
  recommendedMasterId: z.string().optional(),
  items: z.array(itemSchema),
});

export const mergeStrategySchema = z.object({
  primaryItemId: z.string().min(1, 'primaryItemId is required'),
  keepFields: z.record(z.string(), z.string()).optional(),
  deleteDuplicatesAfterMerge: z.boolean().default(true),
});

export const flaggedItemIssueSchema = z.object({
  itemId: z.string(),
  title: z.string().default('Untitled'),
  issues: z.array(z.string()).default([]),
});

export const libraryIntegrityReportSchema = z.object({
  totalItems: z.number().optional().default(0),
  healthyItems: z.number().optional().default(0),
  averageQualityScore: z.number().default(100),
  healthScorePercentage: z.number().default(100),
  missingDoiCount: z.number().default(0),
  missingYearCount: z.number().default(0),
  missingAuthorsCount: z.number().default(0),
  missingAbstractCount: z.number().default(0),
  missingPdfCount: z.number().default(0),
  flaggedItems: z.array(flaggedItemIssueSchema).default([]),
  healthReport: z
    .object({
      missingDoi: z.number().default(0),
      missingAbstract: z.number().default(0),
      missingYear: z.number().default(0),
    })
    .optional(),
});

export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;
export type MergeStrategy = z.infer<typeof mergeStrategySchema>;
export type FlaggedItemIssue = z.infer<typeof flaggedItemIssueSchema>;
export type LibraryIntegrityReport = z.infer<typeof libraryIntegrityReportSchema>;

