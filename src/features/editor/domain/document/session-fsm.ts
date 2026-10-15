/**
 * session-fsm.ts
 *
 * Pure Finite State Machine (Domain Layer) for Document Session Lifecycle.
 * Follows Matt Pocock's Codebase Design principles:
 * - Deep in-process module: Pure computation, 0 side effects, 0 I/O.
 * - Formalizes states to prevent race conditions during rapid tab switching & async network saves.
 */

export type DocumentSessionState =
  | 'idle'
  | 'active'
  | 'dirty'
  | 'saving'
  | 'conflict'
  | 'evicted';

export type DocumentSessionEvent =
  | { type: 'ACTIVATE' }
  | { type: 'DEACTIVATE' }
  | { type: 'LOCAL_EDIT'; version: number }
  | { type: 'REMOTE_EDIT'; version: number }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; savedVersion: number; currentVersion: number }
  | { type: 'SAVE_FAILURE'; error: unknown }
  | { type: 'CONFLICT_DETECTED' }
  | { type: 'CONFLICT_RESOLVED'; resolution: 'keep-local' | 'take-remote' | 'custom-merge' }
  | { type: 'EVICT' };

export interface SessionFsmContext {
  fileId: string;
  state: DocumentSessionState;
  version: number;
  lastSavedVersion: number;
  pendingSaveVersion?: number;
  error?: unknown;
}

export function createInitialSessionContext(fileId: string, initialVersion = 0): SessionFsmContext {
  return {
    fileId,
    state: 'idle',
    version: initialVersion,
    lastSavedVersion: initialVersion,
  };
}

export function sessionFsmTransition(
  ctx: SessionFsmContext,
  event: DocumentSessionEvent
): SessionFsmContext {
  switch (event.type) {
    case 'ACTIVATE': {
      if (ctx.state === 'evicted') return ctx;
      if (ctx.state === 'dirty' || ctx.state === 'saving' || ctx.state === 'conflict') {
        return ctx; // Preserve dirty/saving/conflict state while activating
      }
      return { ...ctx, state: 'active' };
    }

    case 'DEACTIVATE': {
      if (ctx.state === 'active') {
        return { ...ctx, state: 'idle' };
      }
      return ctx; // If dirty/saving, keep that status even when inactive
    }

    case 'LOCAL_EDIT': {
      if (ctx.state === 'evicted') return ctx;
      return {
        ...ctx,
        state: ctx.state === 'saving' ? 'saving' : 'dirty',
        version: event.version,
      };
    }

    case 'REMOTE_EDIT': {
      if (ctx.state === 'evicted') return ctx;
      // Remote edit updates version but preserves lastSavedVersion if local has unsaved/in-flight/conflicting changes
      const hasLocalUnsaved =
        ctx.state === 'dirty' || ctx.state === 'saving' || ctx.state === 'conflict';
      return {
        ...ctx,
        version: event.version,
        lastSavedVersion: hasLocalUnsaved ? ctx.lastSavedVersion : event.version,
      };
    }

    case 'SAVE_START': {
      if (ctx.state !== 'dirty' && ctx.state !== 'saving') return ctx;
      return {
        ...ctx,
        state: 'saving',
        pendingSaveVersion: ctx.version,
        error: undefined,
      };
    }

    case 'SAVE_SUCCESS': {
      // If document was edited while save was in flight:
      const hasPendingEdits = event.currentVersion > event.savedVersion;
      return {
        ...ctx,
        state: hasPendingEdits ? 'dirty' : 'idle',
        lastSavedVersion: event.savedVersion,
        pendingSaveVersion: undefined,
        error: undefined,
      };
    }

    case 'SAVE_FAILURE': {
      return {
        ...ctx,
        state: 'dirty',
        pendingSaveVersion: undefined,
        error: event.error,
      };
    }

    case 'CONFLICT_DETECTED': {
      return {
        ...ctx,
        state: 'conflict',
      };
    }

    case 'CONFLICT_RESOLVED': {
      if (event.resolution === 'take-remote') {
        return {
          ...ctx,
          state: 'idle',
          lastSavedVersion: ctx.version,
        };
      }
      return {
        ...ctx,
        state: 'dirty',
      };
    }

    case 'EVICT': {
      return {
        ...ctx,
        state: 'evicted',
      };
    }

    default:
      return ctx;
  }
}
