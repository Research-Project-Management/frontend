/**
 * collaboration.types.ts
 *
 * Types and validation schemas for real-time collaboration, SSE awareness, cursor broadcast, and line locks.
 * Matches backend document/collaboration module.
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

export type CursorPosition = CursorPositionInput;

export interface CollaboratorPresence {
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: CursorPosition;
  activeFileId?: string;
  lastActiveAt: number;
}

export interface LineLock {
  line: number;
  lockedBy: string;
  lockedByName: string;
  lockedAt: number;
}

export type AwarenessEvent =
  | { type: 'presence'; userId: string; payload: CollaboratorPresence }
  | { type: 'cursor'; userId: string; payload: CursorPosition }
  | { type: 'lock'; userId: string; payload: LineLock }
  | { type: 'unlock'; userId: string; payload: { line: number } };
