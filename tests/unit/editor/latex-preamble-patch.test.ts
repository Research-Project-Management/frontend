import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  diffProposalField,
  createInlineDiffExtension,
} from '@/features/editor/core/engine/extensions/inline-diff';
import { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { setActiveEditorEngine } from '@/features/editor/core';
import {
  isPreambleOnlySnippet,
  computePreambleInsertion,
} from '@/features/editor/domain/latex/latex-preamble-patch';
import {
  aiCoordinator,
  useAiChatActions,
} from '@/features/editor/subsystems/ai';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

describe('latex-preamble-patch & structural preamble insertion', () => {
  let container: HTMLDivElement;
  let views: EditorView[];

  beforeEach(() => {
    views = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    usePageStore.getState().resetPageState();
  });

  afterEach(() => {
    for (const v of views) {
      v.destroy();
    }
    container.remove();
    setActiveEditorEngine(null);
    vi.restoreAllMocks();
  });

  function mountEditor(doc: string, selectionAnchor = 0) {
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: selectionAnchor },
        extensions: [createInlineDiffExtension()],
      }),
      parent: container,
    });
    views.push(view);
    return view;
  }

  describe('isPreambleOnlySnippet', () => {
    it('accepts single and multi-line \\usepackage blocks including comments', () => {
      expect(isPreambleOnlySnippet('\\usepackage[T5]{fontenc}')).toBe(true);
      expect(
        isPreambleOnlySnippet(
          '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}',
        ),
      ).toBe(true);
      expect(
        isPreambleOnlySnippet(
          '% Vietnamese encoding support\n\\usepackage[T5]{fontenc}\n\\RequirePackage{amsmath}',
        ),
      ).toBe(true);
    });

    it('rejects full documents, body text, empty strings, and pure comments', () => {
      expect(isPreambleOnlySnippet('')).toBe(false);
      expect(isPreambleOnlySnippet('% just a comment')).toBe(false);
      expect(
        isPreambleOnlySnippet('\\documentclass{article}\n\\usepackage[T5]{fontenc}'),
      ).toBe(false);
      expect(
        isPreambleOnlySnippet('\\usepackage{amsmath}\n\\begin{document}'),
      ).toBe(false);
      expect(isPreambleOnlySnippet("This is an example \\'{\\^a} text.")).toBe(
        false,
      );
    });
  });

  describe('computePreambleInsertion', () => {
    it('inserts multi-line packages after existing \\usepackage{graphicx} and before \\title / \\begin{document}', () => {
      const doc = [
        '\\documentclass{article}',
        '\\usepackage{graphicx} % Required for inserting images',
        '',
        '\\title{flux}',
        '\\author{Tấn Thành}',
        '\\begin{document}',
        '\\maketitle',
        '\\end{document}',
        '',
      ].join('\n');

      const patch = computePreambleInsertion(
        doc,
        '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}',
      );
      expect(patch).not.toBeNull();
      expect(patch?.changed).toBe(true);
      expect(patch?.addedLines).toEqual([
        '\\usepackage[utf8]{inputenc}',
        '\\usepackage[T1]{fontenc}',
      ]);

      const expectedPrefix =
        '\\documentclass{article}\n\\usepackage{graphicx} % Required for inserting images\n';
      expect(patch?.from).toBe(expectedPrefix.length);
      expect(patch?.updated).toContain(
        '\\usepackage{graphicx} % Required for inserting images\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\n\\title{flux}',
      );
    });

    it('inserts immediately after \\documentclass{article} when no \\usepackage exists yet', () => {
      const doc = '\\documentclass{article}\n\\begin{document}\n\\toprule\n\\end{document}';
      const patch = computePreambleInsertion(doc, '\\usepackage{booktabs}');

      expect(patch?.changed).toBe(true);
      expect(patch?.from).toBe(doc.indexOf('\\begin{document}'));
      expect(patch?.to).toBe(doc.indexOf('\\begin{document}'));
      expect(patch?.insertText).toBe('\\usepackage{booktabs}\n');
    });

    it('never inserts before \\documentclass even if an earlier package is glued onto the same line', () => {
      const doc =
        '\\usepackage[T1]{fontenc}\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}';
      const patch = computePreambleInsertion(doc, '\\usepackage[T5]{fontenc}');

      expect(patch?.changed).toBe(true);
      expect(patch?.updated.indexOf('\\documentclass{article}')).toBeLessThan(
        patch?.updated.indexOf('\\usepackage[T5]{fontenc}') ?? -1,
      );
      expect(patch?.from).toBe(
        '\\usepackage[T1]{fontenc}\\documentclass{article}\n'.length,
      );
    });

    it('deduplicates packages already in preamble while keeping missing ones', () => {
      const doc = [
        '\\documentclass{article}',
        '\\usepackage{graphicx} % Required for inserting images',
        '\\begin{document}',
        'Hello',
        '\\end{document}',
      ].join('\n');

      const alreadyOnly = computePreambleInsertion(doc, '\\usepackage{graphicx}');
      expect(alreadyOnly?.changed).toBe(false);
      expect(alreadyOnly?.addedLines).toEqual([]);
      expect(alreadyOnly?.skippedLines).toEqual(['\\usepackage{graphicx}']);

      const mixed = computePreambleInsertion(
        doc,
        '\\usepackage{graphicx}\n\\usepackage[T5]{fontenc}',
      );
      expect(mixed?.changed).toBe(true);
      expect(mixed?.skippedLines).toEqual(['\\usepackage{graphicx}']);
      expect(mixed?.addedLines).toEqual(['\\usepackage[T5]{fontenc}']);
      expect(mixed?.insertText).toBe('\\usepackage[T5]{fontenc}\n');
    });

    it('ignores commented-out \\documentclass and \\usepackage declarations', () => {
      const doc = [
        '% \\documentclass{book}',
        '\\documentclass{article}',
        '% \\usepackage{fakePkg}',
        '\\title{Test}',
        '\\begin{document}',
        'Body',
        '\\end{document}',
      ].join('\n');

      const patch = computePreambleInsertion(doc, '\\usepackage[T5]{fontenc}');
      expect(patch?.changed).toBe(true);
      expect(patch?.updated).toContain(
        '\\documentclass{article}\n\\usepackage[T5]{fontenc}\n% \\usepackage{fakePkg}',
      );
    });

    it('returns null on subfiles without \\documentclass or \\begin{document} unless fallbackToTop is set', () => {
      const subfile = '\\section{Background}\nSome content here.';
      expect(computePreambleInsertion(subfile, '\\usepackage{amsmath}')).toBeNull();

      const fallback = computePreambleInsertion(subfile, '\\usepackage{amsmath}', {
        fallbackToTop: true,
      });
      expect(fallback?.changed).toBe(true);
      expect(fallback?.from).toBe(0);
      expect(fallback?.insertText).toBe('\\usepackage{amsmath}\n');
    });
  });

  describe('Editor integrations (AiCoordinator.proposeDiff & useAiChatActions.insertAtCursor)', () => {
    it('AiCoordinator.proposeDiff places a 2-line \\usepackage snippet after \\usepackage{graphicx}, not at cursor offset 0', () => {
      const doc = [
        '\\documentclass{article}',
        '\\usepackage{graphicx} % Required for inserting images',
        '',
        '\\author{Tấn Thành}',
        '\\begin{document}',
        '\\end{document}',
      ].join('\n');
      const view = mountEditor(doc, 0);
      const adapter = new CodeMirrorEngineAdapter(view);
      setActiveEditorEngine(adapter);

      const snippet = '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}';
      const proposed = aiCoordinator.proposeDiff('', snippet, {
        title: 'Add packages',
      });

      expect(proposed).toBe(true);
      const pending = view.state.field(diffProposalField).proposal;
      expect(pending).not.toBeNull();
      expect(pending?.from).toBeGreaterThan(doc.indexOf('\\documentclass{article}'));
      expect(pending?.from).toBe(doc.indexOf('\n\n\\author') + 1);
      expect(pending?.replacementText).toBe(
        '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n',
      );
    });

    it('useAiChatActions.insertAtCursor inserts multi-line \\usepackage after \\documentclass instead of dispatching editor:insert-text at offset 0', () => {
      let docContent = [
        '\\documentclass{article}',
        '\\usepackage{graphicx}',
        '\\begin{document}',
        'Hello',
        '\\end{document}',
      ].join('\n');

      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const mockEngine: IEditorEngine = {
        getContent: () => docContent,
        setContent: (next: string) => {
          docContent = next;
        },
        replaceRange: (text: string, from: number, to: number) => {
          docContent = docContent.slice(0, from) + text + docContent.slice(to);
        },
        getSelection: () => null,
        getSelectedText: () => '',
        insertText: vi.fn(),
        wrapSelection: vi.fn(),
        format: vi.fn(),
        jumpToLine: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        focus: vi.fn(),
      };

      const { result } = renderHook(() => useAiChatActions({ engine: mockEngine }));

      act(() => {
        result.current.insertAtCursor(
          '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}',
        );
      });

      expect(docContent).toBe(
        [
          '\\documentclass{article}',
          '\\usepackage{graphicx}',
          '\\usepackage[utf8]{inputenc}',
          '\\usepackage[T1]{fontenc}',
          '\\begin{document}',
          'Hello',
          '\\end{document}',
        ].join('\n'),
      );
      expect(docContent.indexOf('\\usepackage[T1]{fontenc}')).toBeGreaterThan(
        docContent.indexOf('\\documentclass{article}'),
      );
      expect(
        dispatchSpy.mock.calls.some(([cmd]) => cmd.type === 'editor:insert-text'),
      ).toBe(false);
    });
  });
});
