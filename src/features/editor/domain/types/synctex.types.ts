/**
 * synctex.types.ts
 *
 * Types and validation schemas for bidirectional SyncTeX navigation (Editor ⇄ PDF).
 * Matches backend document/synctex module.
 */

import { z } from 'zod';

export const forwardSyncSchema = z.object({
  file: z.string().min(1, 'File path is required'),
  line: z.number().int().min(1, 'Line number must be >= 1'),
  column: z.number().int().min(0).default(0).optional(),
});

export type ForwardSyncInput = z.infer<typeof forwardSyncSchema>;

export const reverseSyncSchema = z.object({
  page: z.number().int().min(1, 'Page number must be >= 1'),
  x: z.number().min(0, 'X coordinate must be >= 0'),
  y: z.number().min(0, 'Y coordinate must be >= 0'),
});

export type ReverseSyncInput = z.infer<typeof reverseSyncSchema>;

export interface SyncPoint {
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ReverseSyncPoint {
  file: string;
  line: number;
  column: number;
}

export type { SyncTeXMap } from '../document/synctex-index';
