import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { CodeMirrorView, buildEditorState } from '@/features/editor/ui/editor/CodeMirrorView';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { reviewCoordinator } from '@/features/editor/subsystems/review';
import { getActiveEditorEngine, setActiveEditorEngine } from '@/features/editor/core';
import { YjsCodeMirrorAdapter } from '@/features/editor/core/engine/collaboration/yjs-codemirror-adapter';

describe('CodeMirrorView: Zero-Remount Document Swapping', () => {
  beforeEach(() => {
    lruDocumentCache.clear();
    setActiveEditorEngine(null);
  });

  afterEach(() => {
    cleanup();
    lruDocumentCache.clear();
    setActiveEditorEngine(null);
    vi.restoreAllMocks();
  });

  it('buildEditorState constructs a complete EditorState with document text and extensions', () => {
    const collabAdapter = new YjsCodeMirrorAdapter();
    const updateListener = EditorView.updateListener.of(() => {});

    const state = buildEditorState({
      fileId: 'file-test',
      filePath: 'test.tex',
      initialText: '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}',
      readOnly: false,
      lineNumbers: true,
      wordWrap: true,
      keybinding: 'standard',
      errorLensEnabled: true,
      spellCheck: false,
      spellCheckLanguage: 'en_US',
      editorTheme: 'auto',
      fontSize: 14,
      editorMode: 'source',
      trackChangesViewMode: 'changes',
      reviewMode: false,
      collabAdapter,
      viewUpdateListener: updateListener,
    });

    expect(state).toBeDefined();
    expect(state.doc.toString()).toBe('\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}');
    expect(state.doc.lines).toBe(4);
  });

  it('swaps document state via view.setState without destroying the EditorView instance', () => {
    const setStateSpy = vi.spyOn(EditorView.prototype, 'setState');
    const destroySpy = vi.spyOn(EditorView.prototype, 'destroy');
    const bindSpy = vi.spyOn(reviewCoordinator, 'bindEditorView');

    // 1. Initial render with doc-1
    const { rerender, unmount } = render(
      <CodeMirrorView
        fileId="doc-1"
        filePath="main.tex"
        value="Document 1 Content"
        isActive={true}
      />
    );

    // Initial mount should NOT have called setState or destroy
    expect(destroySpy).not.toHaveBeenCalled();
    expect(bindSpy).toHaveBeenCalledWith(expect.anything(), 'doc-1');

    // The active engine should be registered
    const initialEngine = getActiveEditorEngine();
    expect(initialEngine).not.toBeNull();
    expect(initialEngine?.getContent()).toBe('Document 1 Content');

    // 2. Tab switch to doc-2 (Zero-remount document swap within same component instance)
    act(() => {
      rerender(
        <CodeMirrorView
          fileId="doc-2"
          filePath="chapter1.tex"
          value="Document 2 Content"
          isActive={true}
        />
      );
    });

    // VERIFY ZERO-REMOUNT:
    // view.setState MUST be called to swap state in-place
    expect(setStateSpy).toHaveBeenCalled();

    // view.destroy MUST NOT be called during tab switch!
    expect(destroySpy).not.toHaveBeenCalled();

    // Previous document doc-1 must be cached in lruDocumentCache
    expect(lruDocumentCache.get('doc-1')).toBeDefined();

    // Active engine must now reflect doc-2 content
    expect(initialEngine?.getContent()).toBe('Document 2 Content');

    // Review coordinator must now be bound to doc-2
    expect(bindSpy).toHaveBeenCalledWith(expect.anything(), 'doc-2');

    // 3. Unmount component (e.g. pane closed)
    act(() => {
      unmount();
    });

    // view.destroy MUST now be called exactly once upon component unmount
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(getActiveEditorEngine()).toBeNull();
  });

  it('preserves and restores cursor selection across zero-remount swaps', () => {
    // Seed doc-1 with a specific cursor position
    lruDocumentCache.updateContent('doc-1', 'Alpha Beta Gamma', false);
    lruDocumentCache.updateViewState('doc-1', { anchor: 6, head: 10 }); // "Beta"

    // Seed doc-2 with a different cursor position
    lruDocumentCache.updateContent('doc-2', 'One Two Three', false);
    lruDocumentCache.updateViewState('doc-2', { anchor: 4, head: 7 }); // "Two"

    const { rerender } = render(
      <CodeMirrorView
        fileId="doc-1"
        filePath="main.tex"
        value="Alpha Beta Gamma"
        isActive={true}
      />
    );

    const engine = getActiveEditorEngine();
    expect(engine).not.toBeNull();

    // Verify selection restored for doc-1 ("Beta" at pos 6..10)
    expect(engine?.getSelectedText()).toBe('Beta');

    // Swap to doc-2
    act(() => {
      rerender(
        <CodeMirrorView
          fileId="doc-2"
          filePath="sub.tex"
          value="One Two Three"
          isActive={true}
        />
      );
    });

    // Selection should now be restored for doc-2 ("Two" at pos 4..7)
    expect(engine?.getSelectedText()).toBe('Two');
  });
});
