import { z } from 'zod';
import { itemSchema } from './item.schema';

export const duplicateGroupSchema = z.object({
  matchType: z.enum(['DOI', 'TITLE_AUTHOR_YEAR']),
  confidence: z.enum(['high', 'medium']),
  key: z.string(),
  papers: z.array(itemSchema),
  items: z.array(itemSchema).optional(),
});

export const mergeStrategySchema = z.object({
  primaryItemId: z.string().min(1, 'primaryItemId is required'),
  keepFields: z.record(z.string(), z.string()).optional(),
  deleteDuplicatesAfterMerge: z.boolean().default(true),
});

export const flaggedItemIssueSchema = z.object({
  itemId: z.string().optional(),
  paperId: z.string().optional(),
  title: z.string().default('Untitled'),
  issues: z.array(z.string()).default([]),
});

export const libraryIntegrityReportSchema = z.object({
  totalItems: z.number().optional().default(0),
  totalPapers: z.number().optional().default(0),
  healthyItems: z.number().optional().default(0),
  healthyPapers: z.number().optional().default(0),
  healthScorePercentage: z.number().default(100),
  missingDoiCount: z.number().default(0),
  missingYearCount: z.number().default(0),
  missingAuthorsCount: z.number().default(0),
  missingPdfCount: z.number().default(0),
  flaggedItems: z.array(flaggedItemIssueSchema).default([]),
});
