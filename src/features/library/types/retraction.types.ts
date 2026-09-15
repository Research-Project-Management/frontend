import { z } from 'zod';
import {
  retractionNatureSchema,
  retractionDetailsSchema,
  flagRetractionInputSchema,
  retractionStatsSchema,
} from '../schemas/retraction.schema';

export type RetractionNature = z.infer<typeof retractionNatureSchema>;
export type RetractionDetails = z.infer<typeof retractionDetailsSchema>;
export type FlagRetractionInput = z.infer<typeof flagRetractionInputSchema>;
export type RetractionStats = z.infer<typeof retractionStatsSchema>;
