import { describe, it, expect } from 'vitest';
import {
  createInitialSessionContext,
  sessionFsmTransition,
  type SessionFsmContext,
} from '@/features/editor/domain/document/session-fsm';

describe('sessionFsmTransition (Pure Domain FSM)', () => {
  it('initializes in idle state with version', () => {
    const ctx = createInitialSessionContext('doc-1', 1);
    expect(ctx.state).toBe('idle');
    expect(ctx.version).toBe(1);
    expect(ctx.lastSavedVersion).toBe(1);
  });

  it('transitions idle -> active on ACTIVATE and back on DEACTIVATE', () => {
    let ctx = createInitialSessionContext('doc-1');
    ctx = sessionFsmTransition(ctx, { type: 'ACTIVATE' });
    expect(ctx.state).toBe('active');

    ctx = sessionFsmTransition(ctx, { type: 'DEACTIVATE' });
    expect(ctx.state).toBe('idle');
  });

  it('transitions active -> dirty on LOCAL_EDIT with bumped version', () => {
    let ctx = createInitialSessionContext('doc-1', 1);
    ctx = sessionFsmTransition(ctx, { type: 'ACTIVATE' });
    ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
    expect(ctx.state).toBe('dirty');
    expect(ctx.version).toBe(2);
  });

  it('manages SAVE_START -> SAVE_SUCCESS when no concurrent edits occurred', () => {
    let ctx = createInitialSessionContext('doc-1', 1);
    ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
    ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
    expect(ctx.state).toBe('saving');
    expect(ctx.pendingSaveVersion).toBe(2);

    ctx = sessionFsmTransition(ctx, {
      type: 'SAVE_SUCCESS',
      savedVersion: 2,
      currentVersion: 2,
    });
    expect(ctx.state).toBe('idle');
    expect(ctx.lastSavedVersion).toBe(2);
    expect(ctx.pendingSaveVersion).toBeUndefined();
  });

  it('retains dirty state on SAVE_SUCCESS if new edits occurred mid-flight', () => {
    let ctx = createInitialSessionContext('doc-1', 1);
    ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
    ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });

    // Mid-flight user edit
    ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 3 });
    expect(ctx.version).toBe(3);

    // Save of version 2 finishes
    ctx = sessionFsmTransition(ctx, {
      type: 'SAVE_SUCCESS',
      savedVersion: 2,
      currentVersion: 3,
    });
    // Still dirty because version 3 needs another save!
    expect(ctx.state).toBe('dirty');
    expect(ctx.lastSavedVersion).toBe(2);
  });

  it('reverts to dirty on SAVE_FAILURE', () => {
    let ctx = createInitialSessionContext('doc-1', 1);
    ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
    ctx = sessionFsmTransition(ctx, { type: 'SAVE_START' });
    ctx = sessionFsmTransition(ctx, { type: 'SAVE_FAILURE', error: new Error('Network error') });

    expect(ctx.state).toBe('dirty');
    expect(ctx.pendingSaveVersion).toBeUndefined();
    expect(ctx.error).toBeDefined();
  });

  it('handles CONFLICT_DETECTED and resolution', () => {
    let ctx = createInitialSessionContext('doc-1', 1);
    ctx = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
    ctx = sessionFsmTransition(ctx, { type: 'CONFLICT_DETECTED' });
    expect(ctx.state).toBe('conflict');

    // Take remote
    const remoteResolved = sessionFsmTransition(ctx, {
      type: 'CONFLICT_RESOLVED',
      resolution: 'take-remote',
    });
    expect(remoteResolved.state).toBe('idle');

    // Keep local
    const localResolved = sessionFsmTransition(ctx, {
      type: 'CONFLICT_RESOLVED',
      resolution: 'keep-local',
    });
    expect(localResolved.state).toBe('dirty');

    // Custom merge
    const mergeResolved = sessionFsmTransition(ctx, {
      type: 'CONFLICT_RESOLVED',
      resolution: 'custom-merge',
    });
    expect(mergeResolved.state).toBe('dirty');
  });

  it('transitions to evicted on EVICT and ignores further edits', () => {
    let ctx = createInitialSessionContext('doc-1', 1);
    ctx = sessionFsmTransition(ctx, { type: 'EVICT' });
    expect(ctx.state).toBe('evicted');

    const afterEdit = sessionFsmTransition(ctx, { type: 'LOCAL_EDIT', version: 2 });
    expect(afterEdit.state).toBe('evicted');
    expect(afterEdit.version).toBe(1);
  });
});
