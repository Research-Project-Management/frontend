/**
 * synctex.schema.ts
 *
 * Zod validation schemas for bidirectional SyncTeX navigation (Editor ⇄ PDF).
 * Matches backend document/synctex module DTOs.
 */

import { z } from 'zod';

export const forwardSyncSchema = z.object({
  file: z.string().min(1, 'Source filename is required'),
  line: z.number().int().min(1, 'Line number must be >= 1'),
  column: z.number().int().min(0).default(0).optional(),
  projectId: z.string().optional(),
  pageId: z.string().optional(),
});

export type ForwardSyncInput = z.infer<typeof forwardSyncSchema>;

export const reverseSyncSchema = z.object({
  page: z.number().int().min(1, 'PDF page must be >= 1'),
  x: z.number(),
  y: z.number(),
  projectId: z.string().optional(),
  pageId: z.string().optional(),
});

export type ReverseSyncInput = z.infer<typeof reverseSyncSchema>;
