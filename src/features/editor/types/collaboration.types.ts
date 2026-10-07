/**
 * collaboration.types.ts
 *
 * Types for real-time collaboration, SSE awareness, cursor broadcast, and line locks.
 * Matches backend document/collaboration module.
 */

import type {
  CursorPositionInput,
  HeartbeatInput,
} from '../schemas/collaboration.schema';

export type CursorPosition = CursorPositionInput;
export type { HeartbeatInput };

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
