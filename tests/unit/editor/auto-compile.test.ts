import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCompileStore } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { editorCommandBus } from '@/features/editor/core';
import { sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';

import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';

describe('Auto-Compile on Typing with Debounce (Overleaf Parity)', () => {
  let unsubscribeCompile: (() => void) | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue({ success: true } as any);
    vi.spyOn(manuscriptService.updater, 'flushProject').mockResolvedValue({ success: true } as any);
    vi.spyOn(draftStorageService, 'saveDraft').mockResolvedValue(undefined);
    vi.spyOn(draftStorageService, 'clearDraft').mockResolvedValue(undefined);
    vi.spyOn(draftStorageService, 'saveMemoryDraft').mockReturnValue({} as any);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    useSettingsStore.setState({ autoCompile: true });
    useCompileStore.setState({
      compileStatus: 'idle',
      pendingCompile: false,
      dirtyContentMap: new Map(),
    });

    lruDocumentCache.registerModel('page-1', {
      content: '\\documentclass{article}\\begin{document}Hello\\end{document}',
    });
  });

  afterEach(() => {
    if (unsubscribeCompile) {
      unsubscribeCompile();
      unsubscribeCompile = null;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should trigger compilation after 1.5s (1500ms) of typing idle', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    // Initial state should not trigger compile
    expect(compileMock).not.toHaveBeenCalled();

    // User types new content
    sessionCoordinator.notifyContentChange(
      'page-1',
      '\\documentclass{article}\\begin{document}Hello World!\\end{document}',
      { isRealtimeActive: false }
    );

    // Advance 1000ms: should NOT compile yet (still in debounce period)
    vi.advanceTimersByTime(1000);
    expect(compileMock).not.toHaveBeenCalled();

    // Advance remaining 500ms to reach 1500ms idle: should compile now!
    vi.advanceTimersByTime(500);
    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should reset debounce timer if user continues typing before 1.5s expires', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    // User types keystroke 1
    sessionCoordinator.notifyContentChange('page-1', 'First sentence.', { isRealtimeActive: false });

    // Wait 1000ms
    vi.advanceTimersByTime(1000);
    expect(compileMock).not.toHaveBeenCalled();

    // User types keystroke 2 (timer resets)
    sessionCoordinator.notifyContentChange('page-1', 'First sentence. Second sentence.', { isRealtimeActive: false });

    // Wait another 1000ms (total 2000ms from start, but only 1000ms from keystroke 2)
    vi.advanceTimersByTime(1000);
    expect(compileMock).not.toHaveBeenCalled();

    // Wait remaining 500ms to hit 1500ms after keystroke 2
    vi.advanceTimersByTime(500);
    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger compilation if content has not changed from previous compilation', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    // User types change
    sessionCoordinator.notifyContentChange('page-1', 'New paragraph.', { isRealtimeActive: false });

    // Advance 1500ms: first compile occurs
    vi.advanceTimersByTime(1500);
    expect(compileMock).toHaveBeenCalledTimes(1);

    // Typing identical content should not trigger compile again
    sessionCoordinator.notifyContentChange('page-1', 'New paragraph.', { isRealtimeActive: false });
    vi.advanceTimersByTime(3000);
    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger compilation when autoCompile setting is disabled (Off)', () => {
    useSettingsStore.setState({ autoCompile: false });
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    sessionCoordinator.notifyContentChange('page-1', 'Editing with auto-compile disabled.', { isRealtimeActive: false });

    vi.advanceTimersByTime(5000);
    expect(compileMock).not.toHaveBeenCalled();
  });
});
