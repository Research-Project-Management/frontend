import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';
import {
  sessionCoordinator,
  useCompileStore,
  editorCommandBus,
  type DocumentConflict,
} from '@/features/editor/core';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';

let seq = 0;
const nextId = (p: string) => `${p}-conflict-${Date.now()}-${seq++}`;

describe('Document Conflict Resolution & 3-Way Merge Deep Module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lruDocumentCache.clear();
    useCompileStore.getState().clearAllDirty();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('surfaces conflicts via onConflict, getConflict, and getConflicts', () => {
    const id = nextId('conflict-query');
    lruDocumentCache.registerModel(id, { content: 'base v1', filePath: 'main.tex' });
    lruDocumentCache.updateContent(id, 'local unsaved edit', true);

    const received: DocumentConflict[] = [];
    const unsub = sessionCoordinator.onConflict((c) => received.push(c));

    sessionCoordinator.handleRemoteContentUpdated(id, 'remote concurrent edit');

    expect(received).toHaveLength(1);
    expect(received[0].fileId).toBe(id);
    expect(received[0].localContent).toBe('local unsaved edit');
    expect(received[0].remoteContent).toBe('remote concurrent edit');

    // Query active conflict
    const active = sessionCoordinator.getConflict(id);
    expect(active).toBeDefined();
    expect(active?.localContent).toBe('local unsaved edit');

    const allConflicts = sessionCoordinator.getConflicts();
    expect(allConflicts.some((c) => c.fileId === id)).toBe(true);

    unsub();
  });

  it('resolves conflict with "keep-local", keeping local edits dirty and scheduling autosave', async () => {
    const id = nextId('keep-local');
    const updateSpy = vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue(undefined as never);

    lruDocumentCache.registerModel(id, { content: 'base v1', filePath: 'main.tex' });
    lruDocumentCache.updateContent(id, 'local master edit', true);
    sessionCoordinator.handleRemoteContentUpdated(id, 'server edit');

    expect(sessionCoordinator.getConflict(id)).toBeDefined();

    sessionCoordinator.resolveConflict(id, 'keep-local');

    // Conflict cleared from registry
    expect(sessionCoordinator.getConflict(id)).toBeUndefined();
    // Local edits retained and dirty
    expect(lruDocumentCache.getModel(id)?.content).toBe('local master edit');
    expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
    expect(sessionCoordinator.getFsmState(id)).toBe('dirty');

    // Autosave scheduled and saves local content
    await vi.advanceTimersByTimeAsync(1200);
    expect(updateSpy).toHaveBeenCalledWith(id, 'local master edit');
  });

  it('resolves conflict with "take-remote", saving local to draft backup and loading remote content', async () => {
    const id = nextId('take-remote');
    const busSpy = vi.fn();
    const unsubBus = editorCommandBus.subscribe('editor:set-content', busSpy);

    lruDocumentCache.registerModel(id, { content: 'base v1', filePath: 'main.tex', projectId: 'test-proj' });
    lruDocumentCache.updateContent(id, 'my local ideas', true);
    sessionCoordinator.handleRemoteContentUpdated(id, 'authoritative remote text');

    sessionCoordinator.resolveConflict(id, 'take-remote');

    // Conflict cleared
    expect(sessionCoordinator.getConflict(id)).toBeUndefined();
    // Cache updated with remote content and marked clean
    expect(lruDocumentCache.getModel(id)?.content).toBe('authoritative remote text');
    expect(lruDocumentCache.getModel(id)?.isDirty).toBe(false);
    expect(useCompileStore.getState().isDirtyFile(id)).toBe(false);

    // FSM state transitioned to idle
    expect(sessionCoordinator.getFsmState(id)).toBe('idle');

    // Dispatched to editor
    expect(busSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:set-content',
      content: 'authoritative remote text',
    }));

    // Previous local version preserved in draft storage
    const draft = await draftStorageService.getDraft(id);
    expect(draft?.content).toBe('my local ideas');

    unsubBus();
  });

  it('resolves conflict with "custom-merge", applying merged content, marking dirty, and preserving draft', async () => {
    const id = nextId('custom-merge');
    const updateSpy = vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue(undefined as never);
    const busSpy = vi.fn();
    const unsubBus = editorCommandBus.subscribe('editor:set-content', busSpy);

    lruDocumentCache.registerModel(id, { content: 'base v1', filePath: 'main.tex', projectId: 'test-proj' });
    lruDocumentCache.updateContent(id, 'Section 1 (Local)', true);
    sessionCoordinator.handleRemoteContentUpdated(id, 'Section 2 (Remote)');

    expect(sessionCoordinator.getConflict(id)).toBeDefined();

    const mergedContent = 'Section 1 (Local)\nSection 2 (Remote) - Merged by User';
    sessionCoordinator.resolveConflict(id, 'custom-merge', mergedContent);

    // Conflict cleared
    expect(sessionCoordinator.getConflict(id)).toBeUndefined();

    // Cache updated with merged content and marked dirty
    expect(lruDocumentCache.getModel(id)?.content).toBe(mergedContent);
    expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
    expect(useCompileStore.getState().isDirtyFile(id)).toBe(true);

    // FSM transitioned to dirty
    expect(sessionCoordinator.getFsmState(id)).toBe('dirty');

    // Dispatched to editor
    expect(busSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:set-content',
      content: mergedContent,
    }));

    // Overwritten local version preserved in draft storage
    const draft = await draftStorageService.getDraft(id);
    expect(draft?.content).toBe('Section 1 (Local)');

    // Autosave scheduled and saves merged content
    await vi.advanceTimersByTimeAsync(1200);
    expect(updateSpy).toHaveBeenCalledWith(id, mergedContent);

    unsubBus();
  });
});
