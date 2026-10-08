import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { VisualEditorView } from '@/features/editor/ui/features/editor/VisualEditorView';
import { useSettingsStore } from '@/features/editor/store';
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/coordinators/command-bus';

describe('Visual Mode Bidirectional Precision SyncTeX (Overleaf Parity)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ editorMode: 'visual' });
    document.execCommand = vi.fn();
    // Mock scrollIntoView in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const testLatex = [
    '\\section{Quantum Field Theory}',
    'This is an introductory paragraph on relativistic quantum fields.',
    '\\begin{equation}',
    '\\mathcal{L} = \\bar{\\psi}(i\\gamma^\\mu \\partial_\\mu - m)\\psi',
    '\\end{equation}',
    '\\begin{figure}[htbp]',
    '\\centering',
    '\\includegraphics{feynman.png}',
    '\\caption{Feynman diagram}',
    '\\end{figure}',
    'Final concluding thoughts of this section.',
  ].join('\n');

  describe('1. Reverse SyncTeX: PDF Preview -> Visual Mode Jump & Pulse Highlight', () => {
    it('scrolls into view and applies synctex-highlight-pulse when editor:jump-to-line is received', async () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const figureEl = container.querySelector('figure.latex-figure-wrapper') as HTMLElement;
      expect(figureEl).toBeTruthy();
      expect(figureEl.getAttribute('data-line')).toBe('6');

      // Dispatch reverse SyncTeX jump command to line 6
      editorCommandBus.dispatch({
        type: 'editor:jump-to-line',
        line: 6,
        highlight: 'synctex',
      });

      expect(figureEl.scrollIntoView).toHaveBeenCalled();
      expect(figureEl.classList.contains('synctex-highlight-pulse')).toBe(true);
    });

    it('applies synctex-highlight-error when jumping to compiler error line', () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const mathEl = container.querySelector('.latex-math-block') as HTMLElement;
      expect(mathEl).toBeTruthy();
      expect(mathEl.getAttribute('data-line')).toBe('3');

      // Dispatch compiler error jump
      editorCommandBus.dispatch({
        type: 'editor:jump-to-line',
        line: 3,
        highlight: 'error',
      });

      expect(mathEl.scrollIntoView).toHaveBeenCalled();
      expect(mathEl.classList.contains('synctex-highlight-error')).toBe(true);
    });

    it('navigates through active editor engine adapter jumpToLine method', () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const engine = getActiveEditorEngine();
      expect(engine).toBeTruthy();

      const heading = container.querySelector('h1') as HTMLElement;
      expect(heading).toBeTruthy();
      expect(heading.getAttribute('data-line')).toBe('1');

      engine.jumpToLine(1, 'synctex');

      expect(heading.scrollIntoView).toHaveBeenCalled();
      expect(heading.classList.contains('synctex-highlight-pulse')).toBe(true);
    });
  });

  describe('2. Forward SyncTeX: Visual Mode Gestures -> PDF Preview Synchronization', () => {
    it('dispatches synctex:forward on double-clicking a block element in Visual Mode', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const figureEl = container.querySelector('figure.latex-figure-wrapper') as HTMLElement;
      expect(figureEl).toBeTruthy();

      // Double-click on figure
      fireEvent.doubleClick(figureEl);

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'synctex:forward',
        line: 6,
        column: 1,
      });
    });

    it('dispatches synctex:forward on Ctrl+Click anywhere on the visual surface', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const mathBlock = container.querySelector('.latex-math-block') as HTMLElement;
      expect(mathBlock).toBeTruthy();

      // Ctrl+Click on math equation
      fireEvent.click(mathBlock, { ctrlKey: true });

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'synctex:forward',
        line: 3,
        column: 1,
      });
    });

    it('dispatches synctex:forward when pressing Mod-Alt-j keyboard shortcut', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const surface = container.querySelector('.visual-editor-surface') as HTMLElement;
      expect(surface).toBeTruthy();

      // Press Ctrl+Alt+J
      fireEvent.keyDown(surface, { key: 'j', ctrlKey: true, altKey: true });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'synctex:forward',
        })
      );
    });

    it('returns accurate cursor line via engine.getCursorPosition based on selection', () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const figureEl = container.querySelector('figure.latex-figure-wrapper') as HTMLElement;
      expect(figureEl).toBeTruthy();

      // Mock selection anchored in figure
      const mockSelection = {
        anchorNode: figureEl,
        focusNode: figureEl,
        rangeCount: 1,
        getRangeAt: () => ({
          getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 }),
        }),
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      const engine = getActiveEditorEngine();
      expect(engine).toBeTruthy();
      const pos = engine.getCursorPosition();
      expect(pos.line).toBe(6);
    });

    it('dispatches synctex:forward when clicking View in PDF button in floating bubble menu', async () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={testLatex}
          onChange={vi.fn()}
        />
      );

      const surface = container.querySelector('.visual-editor-surface') as HTMLElement;
      const textNode = surface.querySelector('p')?.firstChild || surface.firstChild;

      const mockSelection = {
        isCollapsed: false,
        rangeCount: 1,
        anchorNode: textNode,
        focusNode: textNode,
        toString: () => 'introductory paragraph',
        getRangeAt: () => ({
          getBoundingClientRect: () => ({ top: 200, bottom: 220, left: 150, right: 350, width: 200, height: 20 }),
        }),
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      fireEvent(document, new Event('selectionchange'));

      await waitFor(() => {
        expect(screen.getByRole('toolbar', { name: /selection bubble menu/i })).toBeInTheDocument();
      });

      const syncBtn = screen.getByRole('button', { name: /view in pdf \(synctex\)/i });
      expect(syncBtn).toBeInTheDocument();

      fireEvent.click(syncBtn);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'synctex:forward',
        })
      );
    });
  });
});
