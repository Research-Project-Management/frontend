/**
 * editor-hardening-stability.test.ts
 *
 * Comprehensive stability and regression tests for Editor Hardening:
 * 1. Balanced-brace LaTeX parsing (nested styling & escaped braces in headings & formatting).
 * 2. Visual KaTeX Math & Citation selection overlap & multi-line parsing.
 * 3. Command Bus single-execution & active-engine routing without duplication.
 * 4. CodeMirrorView external content synchronization & draft recovery.
 * 5. Split-pane active engine isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  findMatchingBrace,
  latexVisualHeadings,
} from '@/features/editor/engines/extensions/latex-visual-headings';
import { latexVisualMath } from '@/features/editor/engines/extensions/latex-visual-math';
import { latexVisualCitations } from '@/features/editor/engines/extensions/latex-visual-citations';
import {
  editorCommandBus,
  setActiveEditorEngine,
  getActiveEditorEngine,
  registerDefaultBridges,
} from '@/features/editor/coordinators/command-bus';
import { CodeMirrorEngineAdapter } from '@/features/editor/engines/adapters/codemirror.adapter';

describe('Editor Hardening & Stability Verification', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setActiveEditorEngine(null);
    registerDefaultBridges();
  });

  afterEach(() => {
    container.remove();
    setActiveEditorEngine(null);
    vi.clearAllMocks();
  });

  describe('1. Balanced-Brace LaTeX Parser (Fix Bug #5)', () => {
    it('accurately finds matching braces for single-level commands', () => {
      const text = '\\section{Introduction to Quantum Computing}';
      const openIdx = text.indexOf('{');
      const closeIdx = findMatchingBrace(text, openIdx);
      expect(closeIdx).toBe(text.length - 1);
      expect(text.slice(openIdx + 1, closeIdx!)).toBe('Introduction to Quantum Computing');
    });

    it('accurately resolves nested commands without early cutoff on first closing brace', () => {
      const text = '\\section{Introduction to \\textbf{Deep} Learning}';
      const openIdx = text.indexOf('{');
      const closeIdx = findMatchingBrace(text, openIdx);
      expect(closeIdx).toBe(text.length - 1);
      expect(text.slice(openIdx + 1, closeIdx!)).toBe('Introduction to \\textbf{Deep} Learning');

      // Check inner \textbf
      const innerOpenIdx = text.indexOf('{', openIdx + 1);
      const innerCloseIdx = findMatchingBrace(text, innerOpenIdx);
      expect(text.slice(innerOpenIdx + 1, innerCloseIdx!)).toBe('Deep');
    });

    it('handles escaped braces \\{ and \\} correctly without miscounting depth', () => {
      const text = '\\section{Analysis of Set \\{1, 2, 3\\} Properties}';
      const openIdx = text.indexOf('{');
      const closeIdx = findMatchingBrace(text, openIdx);
      expect(closeIdx).toBe(text.length - 1);
      expect(text.slice(openIdx + 1, closeIdx!)).toBe('Analysis of Set \\{1, 2, 3\\} Properties');
    });

    it('returns null gracefully on unclosed brace without throwing', () => {
      const text = '\\section{Unclosed section header';
      const openIdx = text.indexOf('{');
      expect(findMatchingBrace(text, openIdx)).toBeNull();
    });

    it('renders visual headings with nested bold and italic without throwing RangeSetBuilder errors', () => {
      const doc = '\\section{Overview of \\textbf{Robust} and \\textit{Stable} Architectures}\n\\textbf{Bold \\textit{nested} style}';
      const view = new EditorView({
        state: EditorState.create({
          doc,
          extensions: [latexVisualHeadings()],
        }),
        parent: container,
      });

      // If RangeSetBuilder had invalid order or broken nesting, EditorView creation would throw.
      expect(view.state.doc.toString()).toBe(doc);
      view.destroy();
    });
  });

  describe('2. Visual Math & Citations Selection Overlap (Fix Bug #4)', () => {
    it('renders multi-line equation environments safely in Visual Math', () => {
      const doc = '\\begin{equation}\n  E = mc^2\n\\end{equation}\n';
      const view = new EditorView({
        state: EditorState.create({
          doc,
          extensions: [latexVisualMath()],
        }),
        parent: container,
      });

      expect(view.state.doc.toString()).toBe(doc);
      view.destroy();
    });

    it('renders citations and cross-references cleanly with visual badge chips', () => {
      const doc = 'According to \\cite{turing1936} and as seen in \\ref{sec:proof}.';
      const view = new EditorView({
        state: EditorState.create({
          doc,
          extensions: [latexVisualCitations()],
        }),
        parent: container,
      });

      expect(view.state.doc.toString()).toBe(doc);
      view.destroy();
    });
  });

  describe('3. Command Bus Architecture & Single-Execution (Fix Bug #1 & #3)', () => {
    it('executes formatting commands exactly once on the active engine without double-wrapping', () => {
      const view = new EditorView({
        state: EditorState.create({
          doc: 'Hello World',
        }),
        parent: container,
      });

      const adapter = new CodeMirrorEngineAdapter(view);
      setActiveEditorEngine(adapter);

      // Select 'World' (indices 6 to 11)
      view.dispatch({ selection: { anchor: 6, head: 11 } });

      // Dispatch bold format command through CommandBus
      editorCommandBus.dispatch({ type: 'editor:format', format: 'bold' });

      // Content should be wrapped exactly ONCE in \textbf{World}, NOT \textbf{World}\textbf{}
      expect(view.state.doc.toString()).toBe('Hello \\textbf{World}');
      view.destroy();
    });

    it('restores default bridges when registerDefaultBridges() is called after clear()', () => {
      const view = new EditorView({
        state: EditorState.create({
          doc: 'Text to wrap',
        }),
        parent: container,
      });

      const adapter = new CodeMirrorEngineAdapter(view);
      setActiveEditorEngine(adapter);

      // Select 'Text'
      view.dispatch({ selection: { anchor: 0, head: 4 } });

      // Clear bus (wipes all handlers)
      editorCommandBus.clear();
      // Re-register default bridges
      registerDefaultBridges();

      // Dispatch italic
      editorCommandBus.dispatch({ type: 'editor:format', format: 'italic' });

      // Should still format correctly because default bridges are restored
      expect(view.state.doc.toString()).toBe('\\textit{Text} to wrap');
      view.destroy();
    });

    it('supports editor:visual-command through the central bus', () => {
      const view = new EditorView({
        state: EditorState.create({
          doc: 'Itemize target\n',
        }),
        parent: container,
      });

      const adapter = new CodeMirrorEngineAdapter(view);
      setActiveEditorEngine(adapter);

      // Position cursor at end
      view.dispatch({ selection: { anchor: view.state.doc.length, head: view.state.doc.length } });

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'bulletList' });

      expect(view.state.doc.toString()).toContain('\\begin{itemize}');
      expect(view.state.doc.toString()).toContain('\\item');
      expect(view.state.doc.toString()).toContain('\\end{itemize}');
      view.destroy();
    });

    it('routes editor:set-content to active editor engine without crashing', () => {
      const view = new EditorView({
        state: EditorState.create({
          doc: 'Initial content',
        }),
        parent: container,
      });

      const adapter = new CodeMirrorEngineAdapter(view);
      setActiveEditorEngine(adapter);

      editorCommandBus.dispatch({ type: 'editor:set-content', content: 'Restored Draft Content' });

      expect(view.state.doc.toString()).toBe('Restored Draft Content');
      view.destroy();
    });
  });

  describe('4. Dual-Pane Active Engine Isolation (Fix Bug #3)', () => {
    it('isolates commands so only the active pane receives bus actions', () => {
      const view1 = new EditorView({
        state: EditorState.create({ doc: 'Pane 1 Content' }),
        parent: container,
      });
      const view2 = new EditorView({
        state: EditorState.create({ doc: 'Pane 2 Content' }),
        parent: container,
      });

      const adapter1 = new CodeMirrorEngineAdapter(view1);
      const adapter2 = new CodeMirrorEngineAdapter(view2);

      // Activate Pane 1
      setActiveEditorEngine(adapter1);
      expect(getActiveEditorEngine()).toBe(adapter1);

      // Wrap selection on Pane 1
      view1.dispatch({ selection: { anchor: 0, head: 6 } });
      editorCommandBus.dispatch({ type: 'editor:format', format: 'bold' });

      expect(view1.state.doc.toString()).toBe('\\textbf{Pane 1} Content');
      expect(view2.state.doc.toString()).toBe('Pane 2 Content'); // Untouched!

      // Switch to Pane 2
      setActiveEditorEngine(adapter2);
      expect(getActiveEditorEngine()).toBe(adapter2);

      view2.dispatch({ selection: { anchor: 0, head: 6 } });
      editorCommandBus.dispatch({ type: 'editor:format', format: 'italic' });

      expect(view1.state.doc.toString()).toBe('\\textbf{Pane 1} Content'); // Still untouched!
      expect(view2.state.doc.toString()).toBe('\\textit{Pane 2} Content');

      view1.destroy();
      view2.destroy();
    });
  });
});
