/**
 * collaboration.schema.ts
 *
 * Zod validation schemas for Collaboration presence, heartbeat, and cursor telemetry.
 * Matches backend document/collaboration module DTOs.
 */

import { z } from 'zod';

export const cursorPositionSchema = z.object({
  line: z.number().int().min(0),
  ch: z.number().int().min(0),
  selectionEndLine: z.number().int().min(0).optional(),
  selectionEndCh: z.number().int().min(0).optional(),
});

export type CursorPositionInput = z.infer<typeof cursorPositionSchema>;

export const heartbeatSchema = z.object({
  cursor: cursorPositionSchema.optional(),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
