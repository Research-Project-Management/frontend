/**
 * outline.schema.ts
 *
 * Zod validation schemas for Document Section Outline extraction.
 * Matches backend document/outline module DTOs.
 */

import { z } from 'zod';

export const extractOutlineSchema = z.object({
  source: z.string().optional(),
  includeChildren: z.boolean().default(true).optional(),
});

export type ExtractOutlineInput = z.infer<typeof extractOutlineSchema>;
