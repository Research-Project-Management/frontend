import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  editorCommandBus,
  registerEditorEngine,
  setActiveEditorEngine,
  unregisterEditorEngine,
  usePageStore,
} from '@/features/editor/core';
import { createInlineDiffExtension, diffProposalField } from '@/features/editor/core/engine/extensions/inline-diff';
import { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import {
  aiCoordinator,
  resolveAnchorInContent,
} from '@/features/editor/subsystems/ai/coordinator/ai.coordinator';

describe('resolveAnchorInContent & AiCoordinator anchor-verified patching', () => {
  let container: HTMLDivElement;
  let views: EditorView[];
  const registeredEntries: Array<{ id: string; adapter?: IEditorEngine }> = [];

  beforeEach(() => {
    views = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    usePageStore.getState().resetPageState();
  });

  afterEach(() => {
    for (const v of views) v.destroy();
    container.remove();
    setActiveEditorEngine(null);
    unregisterEditorEntries();
    vi.restoreAllMocks();
  });

  function unregisterEditorEntries() {
    while (registeredEntries.length > 0) {
      const entry = registeredEntries.pop();
      if (entry) {
        if (entry.adapter) {
          unregisterEditorEngine(entry.id, entry.adapter);
        }
        aiCoordinator.clearPendingDiffForFile(entry.id);
      }
    }
  }

  function mountWithAdapter(fileId: string, doc: string) {
    const view = new EditorView({
      state: EditorState.create({ doc, extensions: [createInlineDiffExtension()] }),
      parent: container,
    });
    views.push(view);
    const adapter = new CodeMirrorEngineAdapter(view);
    registerEditorEngine(fileId, adapter);
    registeredEntries.push({ id: fileId, adapter });
    setActiveEditorEngine(adapter);
    return { view, adapter };
  }

  it('resolves exact, trimmed whitespace, fromLine disambiguated, and preamble anchors without blind fallback', () => {
    const doc = [
      '\\documentclass{article}',
      '\\begin{document}',
      'Alpha   beta',
      'Duplicate sentence.',
      'Middle filler.',
      'Duplicate sentence.',
      '\\end{document}',
    ].join('\n');

    // Exact match
    const exact = resolveAnchorInContent(doc, {
      kind: 'replace',
      searchText: 'Alpha   beta',
      replaceText: '\\alpha + \\beta',
      fromLine: 3,
      toLine: 3,
    });
    expect(exact).not.toBeNull();
    expect(doc.slice(exact!.from, exact!.to)).toBe('Alpha   beta');

    // Trimmed whitespace fallback
    const ws = resolveAnchorInContent(doc, {
      kind: 'replace',
      searchText: '  Alpha   beta  ',
      replaceText: 'Cleaned',
      fromLine: 3,
      toLine: 3,
    });
    expect(ws).not.toBeNull();
    expect(ws!.originalText).toBe('Alpha   beta');

    // Disambiguate repeated anchor using fromLine proximity
    const nearLine6 = resolveAnchorInContent(doc, {
      kind: 'replace',
      searchText: 'Duplicate sentence.',
      replaceText: 'Updated sixth line.',
      fromLine: 6,
      toLine: 6,
    });
    expect(nearLine6).not.toBeNull();
    expect(doc.slice(0, nearLine6!.from).split('\n').length).toBe(6);

    // Reject completely absent anchor
    const missing = resolveAnchorInContent(doc, {
      kind: 'replace',
      searchText: 'Not in buffer at all',
      replaceText: 'Never applied',
      fromLine: 3,
      toLine: 3,
    });
    expect(missing).toBeNull();

    // Preamble fallback
    const preamble = resolveAnchorInContent(doc, {
      kind: 'insert_preamble',
      searchText: '\\begin{document}',
      replaceText: '\\usepackage{booktabs}\n\\begin{document}',
      fromLine: 2,
      toLine: 2,
    });
    expect(preamble).not.toBeNull();
    expect(preamble!.replacementText).toBe('\\usepackage{booktabs}\n\\begin{document}');
  });

  it('proposes interactive CM6 diff on mounted file and defers+opens unmounted target files', () => {
    const activeDoc = '\\documentclass{article}\n\\begin{document}\nOld paragraph.\n\\end{document}';
    usePageStore.getState().setActiveDocId('doc-main');
    const { view } = mountWithAdapter('doc-main', activeDoc);

    const ok = aiCoordinator.proposePatch({
      id: 'p-mounted',
      fileId: 'doc-main',
      filePath: 'main.tex',
      kind: 'replace',
      title: 'Refine sentence',
      searchText: 'Old paragraph.',
      replaceText: 'Improved academic phrasing.',
      fromLine: 3,
      toLine: 3,
    });
    expect(ok).toBe(true);
    const activeDiff = view.state.field(diffProposalField, false);
    expect(activeDiff?.proposal?.replacementText).toBe('Improved academic phrasing.');

    // Unmounted target dispatches workspace:open-file and resolves on mount
    const openEvents: Array<{ fileId: string; filePath?: string }> = [];
    const unsub = editorCommandBus.subscribe('workspace:open-file', (cmd) => {
      openEvents.push({ fileId: cmd.fileId, filePath: cmd.filePath });
    });

    registeredEntries.push({ id: 'doc-sec' });
    const deferredOk = aiCoordinator.proposePatch({
      id: 'p-unmounted',
      fileId: 'doc-sec',
      filePath: 'sections/intro.tex',
      kind: 'replace',
      title: 'Fix section title',
      searchText: '\\section{Intro}',
      replaceText: '\\section{Introduction}',
      fromLine: 1,
      toLine: 1,
    });
    unsub();

    expect(deferredOk).toBe(true);
    expect(openEvents).toEqual([{ fileId: 'doc-sec', filePath: 'sections/intro.tex' }]);

    const mountedPending = aiCoordinator.consumePendingDiffForFile(
      'doc-sec',
      '\\section{Intro}\nFirst sentence.',
    );
    expect(mountedPending).not.toBeNull();
    expect(mountedPending!.originalText).toBe('\\section{Intro}');
    expect(mountedPending!.replacementText).toBe('\\section{Introduction}');
  });

  it('applies multiple verified hunks bottom-to-top atomically without offset drift', () => {
    const doc = [
      'Line 1 aaa',
      'Line 2 bbb',
      'Line 3 ccc',
      'Line 4 ddd',
    ].join('\n');
    usePageStore.getState().setActiveDocId('doc-multi');
    const { adapter } = mountWithAdapter('doc-multi', doc);

    const result = aiCoordinator.applyAllPatches([
      {
        id: 'hunk-top',
        fileId: 'doc-multi',
        filePath: 'main.tex',
        kind: 'replace',
        title: 'Edit line 1 (shorter)',
        searchText: 'Line 1 aaa',
        replaceText: 'L1',
        fromLine: 1,
        toLine: 1,
      },
      {
        id: 'hunk-bottom',
        fileId: 'doc-multi',
        filePath: 'main.tex',
        kind: 'replace',
        title: 'Edit line 4 (longer)',
        searchText: 'Line 4 ddd',
        replaceText: 'Line 4 MUCH LONGER CONTENT',
        fromLine: 4,
        toLine: 4,
      },
    ]);

    expect(result).toEqual({ applied: 2, failed: 0 });
    expect(adapter.getContent()).toBe(
      ['L1', 'Line 2 bbb', 'Line 3 ccc', 'Line 4 MUCH LONGER CONTENT'].join('\n'),
    );
  });
});
