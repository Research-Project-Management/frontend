import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorSave } from '@/features/editor/components/editor/hooks/use-editor-save';
import { useCompileStore, useSettingsStore } from '@/features/editor/store';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

// Mock usePageActions
vi.mock('@/features/editor/hooks/use-core', () => ({
  usePageActions: () => ({
    updateContent: {
      mutate: vi.fn(),
      isSuccess: false,
      isPending: false,
    },
  }),
}));

describe('Auto-Compile on Typing with Debounce (Overleaf Parity)', () => {
  let unsubscribeCompile: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    useSettingsStore.setState({ autoCompile: true });
    useCompileStore.setState({
      compileStatus: 'idle',
      pendingCompile: false,
      dirtyContentMap: new Map(),
    });
  });

  afterEach(() => {
    if (unsubscribeCompile) {
      unsubscribeCompile();
      unsubscribeCompile = null;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const mockPage = {
    id: 'page-1',
    title: 'main.tex',
    content: '\\documentclass{article}\\begin{document}Hello\\end{document}',
  } as any;

  it('should trigger compilation after 2.5s (2500ms) of typing idle', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    // Initial render should not immediately trigger compile
    expect(compileMock).not.toHaveBeenCalled();

    // User types new content
    act(() => {
      result.current.handleContentChange(
        '\\documentclass{article}\\begin{document}Hello World!\\end{document}',
      );
    });

    // Advance 1000ms: should NOT compile yet (still in debounce period)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(compileMock).not.toHaveBeenCalled();

    // Advance remaining 1500ms to reach 2500ms idle: should compile now!
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should reset debounce timer if user continues typing before 2.5s expires', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    // User types keystroke 1
    act(() => {
      result.current.handleContentChange('First sentence.');
    });

    // Wait 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(compileMock).not.toHaveBeenCalled();

    // User types keystroke 2 (timer resets)
    act(() => {
      result.current.handleContentChange('First sentence. Second sentence.');
    });

    // Wait another 1500ms (total 3000ms from start, but only 1500ms from keystroke 2)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(compileMock).not.toHaveBeenCalled();

    // Wait remaining 1000ms to hit 2500ms after keystroke 2
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger compilation if content has not changed from previous compilation', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    // User types change
    act(() => {
      result.current.handleContentChange('New paragraph.');
    });

    // Advance 2500ms: first compile occurs
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(compileMock).toHaveBeenCalledTimes(1);

    // Wait another 5 seconds with no changes: should not compile again
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should queue pendingCompile = true when compiler is busy (compiling/flushing/syncing)', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    // Set compiler status to compiling (busy)
    useCompileStore.setState({ compileStatus: 'compiling' });

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    // User types while compiler is busy
    act(() => {
      result.current.handleContentChange('Modifications made during compile.');
    });

    // Advance 2500ms
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Should NOT invoke compileMock directly to prevent overlapping compilation
    expect(compileMock).not.toHaveBeenCalled();

    // MUST queue pendingCompile in store
    expect(useCompileStore.getState().pendingCompile).toBe(true);
  });

  it('should allow auto-compile when compileStatus is "done" (Overleaf status lock fix)', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    // Status is 'done' from a previous compilation (previously was locked if status !== 'idle')
    useCompileStore.setState({ compileStatus: 'done' });

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    act(() => {
      result.current.handleContentChange('Next edit after first compile finished.');
    });

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(compileMock).toHaveBeenCalledTimes(1);
  });

  it('should sync lastCompiledContentRef when flux:compile-started event is emitted', () => {
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    // User types and immediately manual compiles
    act(() => {
      result.current.handleContentChange('Manual compile text.');
    });

    // Manual compile fires flux:compile-started before 2.5s idle
    act(() => {
      EditorEventBus.emit('flux:compile-started');
    });

    // Advance timer past 2.5s: because manual compile already covered this text, auto-compile shouldn't fire duplicate
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(compileMock).not.toHaveBeenCalled();
  });

  it('should NOT trigger compilation when autoCompile setting is disabled (Off)', () => {
    useSettingsStore.setState({ autoCompile: false });
    const compileMock = vi.fn();
    unsubscribeCompile = editorCommandBus.subscribe('compiler:trigger', compileMock);

    const { result } = renderHook(() =>
      useEditorSave({ page: mockPage, isRealtimeActive: false }),
    );

    act(() => {
      result.current.handleContentChange('Editing with auto-compile disabled.');
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(compileMock).not.toHaveBeenCalled();
    expect(useCompileStore.getState().pendingCompile).toBe(false);
  });
});
