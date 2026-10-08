import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  diffProposalField,
  proposeDiffEffect,
  acceptDiffEffect,
  rejectDiffEffect,
  createInlineDiffExtension,
} from '@/features/editor/engines/extensions/inline-diff';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { aiCoordinator } from '@/features/editor/coordinators/ai.coordinator';
import { suggestLatexFix } from '@/features/editor/coordinators/services/ai-error-assist.service';
import { CodeMirrorEngineAdapter } from '@/features/editor/engines/adapters/codemirror/codemirror.adapter';
import { setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import { usePageStore } from '@/features/editor/store';
import type { DiffProposal } from '@/features/editor/domain/types/ports/editor-engine.port';

vi.mock('@/features/editor/coordinators/services/ai-error-assist.service', () => ({
  suggestLatexFix: vi.fn(),
}));

describe('AI Inline Ghost Diff & 1-Click Error Assist (Cursor / Overleaf Parity)', () => {
  let view: EditorView;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();

    if (typeof Range.prototype.getClientRects !== 'function') {
      Range.prototype.getClientRects = () =>
        [{ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => {} }] as any;
    }
    if (typeof Range.prototype.getBoundingClientRect !== 'function') {
      Range.prototype.getBoundingClientRect = () =>
        ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => {} }) as any;
    }

    container = document.createElement('div');
    document.body.appendChild(container);

    const state = EditorState.create({
      doc: '\\documentclass{article}\n\\begin{document}\n\\undefinedMacro\n\\end{document}',
      extensions: [createInlineDiffExtension()],
    });

    view = new EditorView({
      state,
      parent: container,
    });

    const adapter = new CodeMirrorEngineAdapter(view);
    setActiveEditorEngine(adapter);

    usePageStore.setState({
      projectId: 'proj-test',
      currentPage: { id: 'main-doc', title: 'main.tex' } as any,
      activeFilePage: { id: 'main-doc', title: 'main.tex', content: view.state.doc.toString() } as any,
    });
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    view.destroy();
    container.remove();
    setActiveEditorEngine(null);
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. Inline Diff StateField & Widget Rendering', () => {
    it('creates red removed-range and green widget decoration when proposeDiffEffect is dispatched', () => {
      const line3 = view.state.doc.line(3);
      const proposal: DiffProposal = {
        id: 'diff-1',
        from: line3.from,
        to: line3.to,
        originalText: line3.text,
        replacementText: '\\textbf{Defined Macro}',
        title: 'AI Fix: Replace undefined macro',
        createdAt: Date.now(),
      };

      act(() => {
        view.dispatch({
          effects: [proposeDiffEffect.of(proposal)],
        });
      });

      const fieldState = view.state.field(diffProposalField);
      expect(fieldState.proposal).not.toBeNull();
      expect(fieldState.proposal?.id).toBe('diff-1');

      // Check DOM rendering for removed range and widget
      const widgetEl = container.querySelector('.cm-inline-diff-widget');
      expect(widgetEl).not.toBeNull();
      expect(widgetEl?.textContent).toContain('AI Fix: Replace undefined macro');
      expect(widgetEl?.textContent).toContain('\\textbf{Defined Macro}');

      // Button labels must display Tab and Esc shortcuts
      const acceptBtn = widgetEl?.querySelector('.cm-diff-btn-accept');
      expect(acceptBtn).not.toBeNull();
      expect(acceptBtn?.textContent).toContain('Tab');

      const rejectBtn = widgetEl?.querySelector('.cm-diff-btn-reject');
      expect(rejectBtn).not.toBeNull();
      expect(rejectBtn?.textContent).toContain('Esc');
    });

    it('clears diff decoration and state when rejectDiffEffect is dispatched', () => {
      const proposal: DiffProposal = {
        id: 'diff-2',
        from: 0,
        to: 10,
        originalText: 'test',
        replacementText: 'replaced',
        createdAt: Date.now(),
      };

      act(() => {
        view.dispatch({ effects: [proposeDiffEffect.of(proposal)] });
      });
      expect(view.state.field(diffProposalField).proposal).not.toBeNull();

      act(() => {
        view.dispatch({ effects: [rejectDiffEffect.of('diff-2')] });
      });
      expect(view.state.field(diffProposalField).proposal).toBeNull();
      expect(container.querySelector('.cm-inline-diff-widget')).toBeNull();
    });
  });

  describe('2. Keybinding Interactions (Tab, Mod-Enter, Escape)', () => {
    it('accepts proposal on Tab keypress and updates the document text', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const line3 = view.state.doc.line(3);
      const proposal: DiffProposal = {
        id: 'diff-tab',
        from: line3.from,
        to: line3.to,
        originalText: line3.text,
        replacementText: '\\section{Introduction}',
        createdAt: Date.now(),
      };

      act(() => {
        view.dispatch({ effects: [proposeDiffEffect.of(proposal)] });
      });

      // Simulate Tab keydown on CodeMirror contentDOM
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        view.contentDOM.dispatchEvent(tabEvent);
      });

      // Document line 3 must now be the replacement
      expect(view.state.doc.line(3).text).toBe('\\section{Introduction}');

      // Proposal must be cleared
      expect(view.state.field(diffProposalField).proposal).toBeNull();

      // ai:diff-resolved event must be dispatched
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai:diff-resolved',
          action: 'accept',
        }),
      );
    });

    it('rejects proposal on Escape keypress without modifying document text', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const originalDoc = view.state.doc.toString();
      const line3 = view.state.doc.line(3);

      const proposal: DiffProposal = {
        id: 'diff-esc',
        from: line3.from,
        to: line3.to,
        originalText: line3.text,
        replacementText: '\\shouldNotBeApplied',
        createdAt: Date.now(),
      };

      act(() => {
        view.dispatch({ effects: [proposeDiffEffect.of(proposal)] });
      });

      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        view.contentDOM.dispatchEvent(escEvent);
      });

      // Document remains untouched
      expect(view.state.doc.toString()).toBe(originalDoc);
      expect(view.state.field(diffProposalField).proposal).toBeNull();

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai:diff-resolved',
          action: 'reject',
        }),
      );
    });

    it('accepts proposal on Accept button click in widget header', () => {
      const line3 = view.state.doc.line(3);
      const proposal: DiffProposal = {
        id: 'diff-click',
        from: line3.from,
        to: line3.to,
        originalText: line3.text,
        replacementText: '\\textbf{Clicked Accept}',
        createdAt: Date.now(),
      };

      act(() => {
        view.dispatch({ effects: [proposeDiffEffect.of(proposal)] });
      });

      const acceptBtn = container.querySelector('.cm-diff-btn-accept') as HTMLButtonElement;
      expect(acceptBtn).not.toBeNull();

      act(() => {
        acceptBtn.click();
      });

      expect(view.state.doc.line(3).text).toBe('\\textbf{Clicked Accept}');
      expect(view.state.field(diffProposalField).proposal).toBeNull();
    });
  });

  describe('3. aiCoordinator 1-Click AutoFix & Compiler Error Integration', () => {
    it('executes autoFixDiagnostic, calls AI service, and mounts inline diff', async () => {
      vi.mocked(suggestLatexFix).mockResolvedValue({
        fixedSnippet: '\\textbf{Fixed Macro}',
        explanation: 'Replaced unknown macro with textbf',
        confidence: 'high',
        startLine: 3,
        endLine: 3,
      });

      const jumpSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const success = await aiCoordinator.autoFixDiagnostic({
        id: 'err-1',
        message: 'Undefined control sequence \\undefinedMacro',
        line: 3,
        file: 'main.tex',
        severity: 'error',
      });

      expect(success).toBe(true);
      expect(suggestLatexFix).toHaveBeenCalledTimes(1);

      // Must have jumped to line 3
      expect(jumpSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'navigation:jump-to-line',
          line: 3,
        }),
      );

      // Proposal must be mounted in CodeMirror view
      const currentProposal = view.state.field(diffProposalField).proposal;
      expect(currentProposal).not.toBeNull();
      expect(currentProposal?.replacementText).toBe('\\textbf{Fixed Macro}');
    });

    it('auto-triggers compilation after accepting an AI diff', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      // Dispatch ai:diff-resolved with accept action
      act(() => {
        editorCommandBus.dispatch({
          type: 'ai:diff-resolved',
          action: 'accept',
        });
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'compiler:trigger',
          draft: true,
        }),
      );
    });
  });
});
