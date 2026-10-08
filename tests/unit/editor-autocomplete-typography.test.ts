import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  createLatexCompletionSource,
  type LatexBibEntryInput,
  type LatexFileInput,
} from '@/features/editor/engines/extensions/latex-autocomplete';
import { useSettingsStore } from '@/features/editor/store';

describe('Editor Autocompletion & Typography (Overleaf Parity)', () => {
  describe('1. Package Autocompletion (\\usepackage{...})', () => {
    it('should suggest standard CTAN packages inside \\usepackage{}', () => {
      const doc = '\\usepackage{ams';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource();
      const result = completionSource(context);

      expect(result).not.toBeNull();
      expect(result?.options.length).toBeGreaterThanOrEqual(30);

      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('amsmath');
      expect(labels).toContain('amssymb');
      expect(labels).toContain('amsfonts');
      expect(labels).toContain('graphicx');
      expect(labels).toContain('hyperref');
      expect(labels).toContain('booktabs');
      expect(labels).toContain('tikz');
    });

    it('should support \\usepackage with optional arguments: \\usepackage[margin=1in]{...}', () => {
      const doc = '\\usepackage[utf8]{in';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource();
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('inputenc');
    });
  });

  describe('2. Document & Image Path Autocompletion (\\input, \\include, \\includegraphics)', () => {
    const mockFiles: LatexFileInput[] = [
      { name: 'main.tex', path: 'main.tex' },
      { name: 'sections/introduction.tex', path: 'sections/introduction.tex' },
      { name: 'sections/methodology.tex', path: 'sections/methodology.tex' },
      { name: 'figures/architecture.png', path: 'figures/architecture.png' },
      { name: 'figures/results_chart.pdf', path: 'figures/results_chart.pdf' },
      { name: 'references.bib', path: 'references.bib' },
    ];

    it('should suggest .tex files for \\input{...}', () => {
      const doc = '\\input{sec';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource([], mockFiles);
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('sections/introduction.tex');
      expect(labels).toContain('sections/methodology.tex');
      expect(labels).toContain('main.tex');
      // Should filter out images for \input
      expect(labels).not.toContain('figures/architecture.png');
    });

    it('should suggest .tex files for \\include{...}', () => {
      const doc = '\\include{sections/';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource([], () => mockFiles);
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('sections/introduction.tex');
      expect(labels).toContain('sections/methodology.tex');
    });

    it('should suggest image assets for \\includegraphics{...}', () => {
      const doc = '\\includegraphics{fig';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource([], mockFiles);
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('figures/architecture.png');
      expect(labels).toContain('figures/results_chart.pdf');
      // Should not suggest .tex files
      expect(labels).not.toContain('main.tex');
    });

    it('should suggest image assets with scaling options: \\includegraphics[width=0.8\\linewidth]{...}', () => {
      const doc = '\\includegraphics[width=0.5\\textwidth]{fig';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource([], mockFiles);
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('figures/architecture.png');
    });
  });

  describe('3. Core Overleaf Autocompletion (\\begin, \\cite, \\ref)', () => {
    it('should complete \\begin{...} with matching \\end{...}', () => {
      const doc = '\\begin{equa';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, doc.length, true);

      const completionSource = createLatexCompletionSource();
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('equation');
      expect(labels).toContain('equation*');
    });

    it('should complete citations from bibSource and inline \\bibitem', () => {
      const bibEntries: LatexBibEntryInput[] = [
        { key: 'vaswani2017attention', title: 'Attention Is All You Need', year: 2017 },
        { citationKey: 'devlin2018bert', author: 'Devlin et al.', year: 2018 },
      ];
      const doc = 'As shown in \\cite{vas\n\\bibitem{einstein1905}';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, 21, true); // right after \cite{vas

      const completionSource = createLatexCompletionSource(bibEntries);
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('vaswani2017attention');
      expect(labels).toContain('devlin2018bert');
      expect(labels).toContain('einstein1905');
    });

    it('should complete cross-reference labels from document \\label{...}', () => {
      const doc = 'Equation \\eqref{eq:bayes} and section \\ref{sec:\n\\label{sec:methods}\n\\label{eq:bayes}';
      const state = EditorState.create({ doc });
      const context = new CompletionContext(state, 43, true); // right after \ref{sec:

      const completionSource = createLatexCompletionSource();
      const result = completionSource(context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((opt) => opt.label);
      expect(labels).toContain('sec:methods');
      expect(labels).toContain('eq:bayes');
    });
  });

  describe('4. Settings Store Typography Defaults & Updaters', () => {
    it('should support font size, font family, and line height adjustments', () => {
      const store = useSettingsStore.getState();

      // Check defaults
      expect(store.fontSize).toBeDefined();
      expect(store.fontFamily).toBeDefined();
      expect(store.lineHeight).toBeDefined();
      expect(store.lineHeight).toBe(1.6);

      // Verify updaters
      store.setFontSize(18);
      expect(useSettingsStore.getState().fontSize).toBe(18);

      store.setFontFamily('fira');
      expect(useSettingsStore.getState().fontFamily).toBe('fira');

      store.setLineHeight(1.9);
      expect(useSettingsStore.getState().lineHeight).toBe(1.9);

      // Reset to defaults
      store.setFontSize(15);
      store.setFontFamily('default');
      store.setLineHeight(1.6);
    });

    it('should support toggling word wrap, line numbers, brackets, linter, and non-blinking cursor', () => {
      const store = useSettingsStore.getState();

      store.setWordWrap(false);
      expect(useSettingsStore.getState().wordWrap).toBe(false);
      store.setWordWrap(true);

      store.setLineNumbers(false);
      expect(useSettingsStore.getState().lineNumbers).toBe(false);
      store.setLineNumbers(true);

      store.setAutoCloseBrackets(false);
      expect(useSettingsStore.getState().autoCloseBrackets).toBe(false);
      store.setAutoCloseBrackets(true);

      store.setNonBlinkingCursor(true);
      expect(useSettingsStore.getState().nonBlinkingCursor).toBe(true);
      store.setNonBlinkingCursor(false);

      store.setLinterEnabled(false);
      expect(useSettingsStore.getState().linterEnabled).toBe(false);
      store.setLinterEnabled(true);
    });
  });

  describe('5. Real-Time LaTeX Code Check Diagnostics (Overleaf Parity)', () => {
    it('should detect unclosed environment and unescaped characters in document', async () => {
      const { runLatexLinter } = await import('@/features/editor/domain/latex/latex-linter');
      const text = '\\begin{equation}\nx = y\n\n\\section{Introduction}\nHere is a 50% discount and an unescaped_variable.';
      const diagnostics = runLatexLinter(text);

      expect(diagnostics.length).toBeGreaterThanOrEqual(2);

      const unclosedEnv = diagnostics.find((d) => d.code === 'UNCLOSED_ENV');
      expect(unclosedEnv).toBeDefined();
      expect(unclosedEnv?.message).toContain('\\begin{equation}');

      const unescapedPct = diagnostics.find((d) => d.code === 'UNESCAPED_PERCENT');
      expect(unescapedPct).toBeDefined();
    });
  });

  describe('6. Multiple Cursors & Box Selection Extensions', () => {
    it('should allow multiple selections across document', async () => {
      const { rectangularSelection, crosshairCursor } = await import('@codemirror/view');
      const { EditorSelection } = await import('@codemirror/state');
      const doc = 'Line 1: A\nLine 2: B\nLine 3: C';
      const state = EditorState.create({
        doc,
        extensions: [
          EditorState.allowMultipleSelections.of(true),
          rectangularSelection(),
          crosshairCursor(),
        ],
        selection: EditorSelection.create([
          EditorSelection.cursor(0),
          EditorSelection.cursor(10),
        ]),
      });

      expect(state.facet(EditorState.allowMultipleSelections)).toBe(true);
      expect(state.selection.ranges.length).toBe(2);
    });
  });
});
