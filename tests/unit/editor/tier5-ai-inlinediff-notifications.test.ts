import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  diffProposalField,
  proposeDiffEffect,
  createInlineDiffExtension,
} from '@/features/editor/core/engine/extensions/inline-diff';
import { createCodeMirrorPreset, reconfigureVisualMode } from '@/features/editor/core/engine/codemirror/codemirror-preset';
import { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import {
  reviewStateField,
  setSuggestionsEffect,
  createReviewExtension,
} from '@/features/editor/subsystems/review';
import { VISUAL_COMMAND_STRATEGIES, editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { latexVisualMath } from '@/features/editor/core/engine/extensions/latex-visual-math';
import { aiCoordinator } from '@/features/editor/subsystems/ai/coordinator/ai.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { setActiveEditorEngine } from '@/features/editor/core';
import { fluxTransport } from '@/features/ai';
import { decodeFluxSseFrame } from '@/features/ai/transport/sse';
import type { DiffProposal } from '@/features/editor/domain/types/ports/editor-engine.port';

describe('Khối 2 / Tầng 5 Frontend — Inline Diff, Visual Mode, Copilot Chat & Track Changes Integration', () => {
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

  function mountEditor(doc: string, extensions: any[] = createCodeMirrorPreset()) {
    const view = new EditorView({
      state: EditorState.create({ doc, extensions }),
      parent: container,
    });
    views.push(view);
    return view;
  }

  describe('1. InlineDiffWidget Safety, Keymap Precedence & Live Offsets', () => {
    it('uses live diffProposalField offsets after simulated remote insertions above the proposal (stale closure regression)', () => {
      const initialDoc = '\\documentclass{article}\n\\begin{document}\nOld target line\n\\end{document}';
      const view = mountEditor(initialDoc, [createInlineDiffExtension()]);

      const targetLine = view.state.doc.line(3);
      const proposal: DiffProposal = {
        id: 'diff-shift',
        from: targetLine.from,
        to: targetLine.to,
        originalText: targetLine.text,
        replacementText: 'New target line',
        title: 'Shift test',
        createdAt: Date.now(),
      };

      view.dispatch({ effects: [proposeDiffEffect.of(proposal)] });

      // Simulate remote Yjs insertion at index 0 BEFORE clicking the already-mounted Accept button
      const prefix = '% Remote collaborator comment\n';
      view.dispatch({ changes: { from: 0, to: 0, insert: prefix } });

      const acceptBtn = container.querySelector('.cm-diff-btn-accept') as HTMLButtonElement;
      expect(acceptBtn).not.toBeNull();
      acceptBtn.click();

      const resultingLines = view.state.doc.toString().split('\n');
      expect(resultingLines[0]).toBe('% Remote collaborator comment');
      expect(resultingLines[3]).toBe('New target line');
      expect(view.state.field(diffProposalField).proposal).toBeNull();
    });

    it('neutralizes HTML injection in proposal.title via safe DOM textContent', () => {
      (window as any).__xssTriggered = false;
      const view = mountEditor('Hello world', [createInlineDiffExtension()]);

      view.dispatch({
        effects: [
          proposeDiffEffect.of({
            id: 'diff-xss',
            from: 0,
            to: 5,
            originalText: 'Hello',
            replacementText: 'Greetings',
            title: '<img src="x" onerror="window.__xssTriggered=true">',
            createdAt: Date.now(),
          }),
        ],
      });

      const titleEl = container.querySelector('.cm-inline-diff-title');
      expect(titleEl).not.toBeNull();
      expect(titleEl?.querySelector('img')).toBeNull();
      expect(titleEl?.textContent).toContain('<img src="x" onerror="window.__xssTriggered=true">');
      expect((window as any).__xssTriggered).toBe(false);
    });

    it('Prec.highest inlineDiffKeymap wins Tab acceptance over indentWithTab in full preset', () => {
      const view = mountEditor('\\undefinedMacro', createCodeMirrorPreset({ enableInlineDiff: true }));
      const line1 = view.state.doc.line(1);
      view.dispatch({
        effects: [
          proposeDiffEffect.of({
            id: 'diff-prec-tab',
            from: line1.from,
            to: line1.to,
            originalText: line1.text,
            replacementText: '\\definedMacro',
            createdAt: Date.now(),
          }),
        ],
      });

      view.contentDOM.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }),
      );

      expect(view.state.doc.toString()).toBe('\\definedMacro');
      expect(view.state.field(diffProposalField).proposal).toBeNull();
    });

    it('blocks diff acceptance when CodeMirror view is readOnly', () => {
      const view = mountEditor(
        'Original content',
        createCodeMirrorPreset({ readOnly: true, enableInlineDiff: true }),
      );
      const adapter = new CodeMirrorEngineAdapter(view);

      view.dispatch({
        effects: [
          proposeDiffEffect.of({
            id: 'diff-ro',
            from: 0,
            to: 8,
            originalText: 'Original',
            replacementText: 'Modified',
            createdAt: Date.now(),
          }),
        ],
      });

      const acceptBtn = container.querySelector('.cm-diff-btn-accept') as HTMLButtonElement | null;
      acceptBtn?.click();
      adapter.acceptDiff('diff-ro');

      expect(view.state.doc.toString()).toBe('Original content');
    });

    it('Track Changes reviewMode records accepted AI inline diff as delete+insert while clearing diffProposalField', () => {
      const view = mountEditor('Alpha beta', [
        createInlineDiffExtension(),
        createReviewExtension({ pageId: 'doc-1', reviewMode: true, viewMode: 'changes' }),
      ]);
      const adapter = new CodeMirrorEngineAdapter(view);

      view.dispatch({
        effects: [
          proposeDiffEffect.of({
            id: 'diff-tc',
            from: 6,
            to: 10,
            originalText: 'beta',
            replacementText: 'gamma',
            createdAt: Date.now(),
          }),
        ],
      });

      adapter.acceptDiff('diff-tc');

      expect(view.state.field(diffProposalField).proposal).toBeNull();
      const tcState = view.state.field(reviewStateField);
      expect(tcState.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(tcState.suggestions.some((s) => s.type === 'delete' && s.originalText === 'beta')).toBe(true);
      expect(tcState.suggestions.some((s) => s.type === 'insert' && s.suggestedText === 'gamma')).toBe(true);
    });

    it('reviewStateField remaps existing suggestion offsets across remote document insertions', () => {
      const view = mountEditor('Alpha target word', [
        createReviewExtension({ pageId: 'doc-1', reviewMode: false }),
      ]);

      view.dispatch({
        effects: [
          setSuggestionsEffect.of([
            {
              id: 'sug-1',
              pageId: 'doc-1',
              type: 'insert',
              originalText: '',
              suggestedText: 'target',
              fromIndex: 6,
              toIndex: 12,
              fromLine: 1,
              fromColumn: 7,
              toLine: 1,
              toColumn: 13,
              status: 'pending',
              authorId: 'u-1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        ],
      });

      view.dispatch({ changes: { from: 0, to: 0, insert: '12345' } });
      const sug = view.state.field(reviewStateField).suggestions[0];
      expect(sug.fromIndex).toBe(11);
      expect(sug.toIndex).toBe(17);
    });
  });

  describe('2. AiCoordinator Preamble Insertion, SpaceId Forwarding & Cross-File Queue', () => {
    it('proposes \\usepackage{booktabs} right before \\begin{document} instead of overwriting error line', () => {
      const doc = '\\documentclass{article}\n\\begin{document}\n\\toprule\n\\end{document}';
      const view = mountEditor(doc, [createInlineDiffExtension()]);
      const adapter = new CodeMirrorEngineAdapter(view);
      setActiveEditorEngine(adapter);

      usePageStore.setState({ activeFilePage: { id: 'doc-main', title: 'main.tex' } as any });
      const proposed = aiCoordinator.proposeDiff('doc-main', '\\usepackage{booktabs}', {
        line: 3,
        title: 'Add booktabs',
      });

      expect(proposed).toBe(true);
      const pending = view.state.field(diffProposalField).proposal;
      expect(pending).not.toBeNull();
      expect(pending?.replacementText).toBe('\\usepackage{booktabs}\n');
      expect(pending?.from).toBe(doc.indexOf('\\begin{document}'));
      expect(pending?.to).toBe(doc.indexOf('\\begin{document}'));
    });

    it('queues and consumes cross-file DiffProposal when target file engine is not yet active', () => {
      usePageStore.setState({
        activeFilePage: { id: 'doc-a', title: 'a.tex' } as any,
      });
      const ok = aiCoordinator.proposeDiff('doc-b', '\\textbf{Fixed}', {
        line: 1,
        title: 'Cross-file fix',
      });

      expect(ok).toBe(true);
      const consumed = aiCoordinator.consumePendingDiffForFile('doc-b');
      expect(consumed?.replacementText).toBe('\\textbf{Fixed}');
      expect(aiCoordinator.consumePendingDiffForFile('doc-b')).toBeNull();
    });
  });

  describe('3. SSE Metadata Filtering & Page Chat Payload', () => {
    it('decodeFluxSseFrame decodes canonical events and drops unknown JSON frames', () => {
      const metaEvents = decodeFluxSseFrame(
        'message',
        '{"type":"meta","chatId":"chat-99","title":"Proof"}',
      );
      expect(metaEvents).toEqual([
        {
          type: 'meta',
          chatId: 'chat-99',
          title: 'Proof',
        },
      ]);

      const unknownEvents = decodeFluxSseFrame(
        'message',
        '{"trace_id":"t-1","chat_id":"chat-99"}',
      );
      expect(unknownEvents).toEqual([]);

      const contentEvents = decodeFluxSseFrame(
        'message',
        '{"type":"text-delta","delta":"Hello LaTeX"}',
      );
      expect(contentEvents).toEqual([{ type: 'text-delta', delta: 'Hello LaTeX' }]);
    });

    it('fluxTransport.stream sends spaceId, pageId, chatId, attachments, and documentStructure for editor mode', async () => {
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode('data: {"type":"meta","chatId":"chat-1"}\n\n'));
          c.enqueue(encoder.encode('data: {"trace_id":"tr-1"}\n\n'));
          c.enqueue(encoder.encode('data: {"type":"text-delta","delta":"Done"}\n\n'));
          c.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          c.close();
        },
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: streamBody,
      } as any);

      const metas: unknown[] = [];
      const chunks: string[] = [];
      const streamResult = await fluxTransport.stream({
        messages: [{ role: 'user', content: 'Hi', attachments: [{ id: 'f1', name: 'ref.pdf' }] }],
        context: {
          mode: 'editor',
          spaceId: 'sp-1',
          chatId: 'chat-1',
          editor: {
            pageId: 'pg-1',
            documentStructure: '\\section{One}',
          },
        },
      });

      for await (const ev of streamResult.events) {
        if (ev.type === 'meta') metas.push(ev);
        if (ev.type === 'text-delta') chunks.push(ev.delta);
      }

      expect(chunks).toEqual(['Done']);
      expect(metas[0]).toMatchObject({ type: 'meta', chatId: 'chat-1' });
      const sentBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as {
        spaceId: string;
        pageId: string;
        chatId: string;
        documentStructure: string;
        messages: Array<{ attachments: Array<{ id: string; name: string }> }>;
      };
      expect(sentBody.spaceId).toBe('sp-1');
      expect(sentBody.pageId).toBe('pg-1');
      expect(sentBody.chatId).toBe('chat-1');
      expect(sentBody.documentStructure).toBe('\\section{One}');
      expect(sentBody.messages[0].attachments).toEqual([{ id: 'f1', name: 'ref.pdf' }]);
    });
  });

  describe('4. Visual Mode Commands, Display Math & Normal Unwrap', () => {
    it('VISUAL_COMMAND_STRATEGIES supports heading levels 0..3, normal unwrap preserving text, and createLink', () => {
      const view = mountEditor('\\section{Methodology}\nClick here', createCodeMirrorPreset());
      const adapter = new CodeMirrorEngineAdapter(view);

      // Unwrap heading -> preserves "Methodology" instead of deleting text
      view.dispatch({ selection: { anchor: 2 } });
      VISUAL_COMMAND_STRATEGIES.normal(adapter);
      expect(view.state.doc.line(1).text).toBe('Methodology');

      // Title (level 0)
      view.dispatch({ selection: { anchor: 0, head: 11 } });
      VISUAL_COMMAND_STRATEGIES.heading(adapter, { level: 0 });
      expect(view.state.doc.line(1).text).toBe('\\title{Methodology}');

      // Link wraps selection with \href{url}{selected}
      const line2 = view.state.doc.line(3);
      view.dispatch({ selection: { anchor: line2.from, head: line2.to } });
      VISUAL_COMMAND_STRATEGIES.createLink(adapter, { contentHtml: 'https://flux.dev' });
      expect(view.state.doc.line(3).text).toBe('\\href{https://flux.dev}{Click here}');
    });

    it('reconfigureVisualMode respects showLineNumbers=false when exiting visual mode', () => {
      const view = mountEditor('Hello', createCodeMirrorPreset({ enableVisualMode: true, lineNumbers: false }));
      reconfigureVisualMode(view, false, undefined, false);
      expect(container.querySelector('.cm-lineNumbers')).toBeNull();
    });

    it('latexVisualMath strips \\label and renders \\begin{equation} inner body without leaking environment syntax', () => {
      const view = mountEditor('\\begin{equation}\\label{eq:einstein}\nE = mc^2\n\\end{equation}', [
        latexVisualMath(),
      ]);
      // Move selection outside the equation so widget renders
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\n\nOutside line' }, selection: { anchor: view.state.doc.length + 14 } });

      const displayWidget = container.querySelector('.cm-visual-math-display');
      expect(displayWidget).not.toBeNull();
      expect(displayWidget?.textContent).not.toContain('begin{equation}');
    });
  });
});
