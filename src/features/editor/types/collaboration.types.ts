/**
 * collaboration.types.ts
 *
 * Types for real-time collaboration, SSE awareness, cursor broadcast, and line locks.
 * Matches backend document/collaboration module.
 */

export interface CursorPosition {
  line: number;
  ch: number;
  selectionEndLine?: number;
  selectionEndCh?: number;
}

export interface HeartbeatInput {
  cursor?: CursorPosition;
}

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

export interface AwarenessEvent {
  type: 'presence' | 'cursor' | 'lock' | 'unlock';
  userId: string;
  payload: any;
}
