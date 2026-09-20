import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSettingsStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import {
  latexToHtml,
  htmlToLatex,
  renderMathHtml,
} from '@/features/editor/utils/latex-converter.util';

describe('Source vs Visual Editor Mode (Overleaf 1:1 Parity)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ editorMode: 'code' });
  });

  describe('Settings Store editorMode State', () => {
    it('should default to code (Source) mode', () => {
      const mode = useSettingsStore.getState().editorMode;
      expect(mode).toBe('code');
    });

    it('should allow setting mode to visual', () => {
      useSettingsStore.getState().setEditorMode('visual');
      expect(useSettingsStore.getState().editorMode).toBe('visual');
    });

    it('should allow toggling between code and visual mode', () => {
      expect(useSettingsStore.getState().editorMode).toBe('code');

      useSettingsStore.getState().toggleEditorMode();
      expect(useSettingsStore.getState().editorMode).toBe('visual');

      useSettingsStore.getState().toggleEditorMode();
      expect(useSettingsStore.getState().editorMode).toBe('code');
    });
  });

  describe('Visual Editor Command Bus (EditorEventBus delegation)', () => {
    it('should dispatch and receive flux:visual-command events for formatting', () => {
      const listener = vi.fn();
      const unsub = EditorEventBus.on('flux:visual-command', listener);

      EditorEventBus.emit('flux:visual-command', { command: 'bold' });
      expect(listener).toHaveBeenCalledWith({ command: 'bold' });

      EditorEventBus.emit('flux:visual-command', { command: 'italic' });
      expect(listener).toHaveBeenCalledWith({ command: 'italic' });

      EditorEventBus.emit('flux:visual-command', { command: 'heading', level: 2 });
      expect(listener).toHaveBeenCalledWith({ command: 'heading', level: 2 });

      EditorEventBus.emit('flux:visual-command', { command: 'insertMath' });
      expect(listener).toHaveBeenCalledWith({ command: 'insertMath' });

      unsub();

      EditorEventBus.emit('flux:visual-command', { command: 'strike' });
      expect(listener).toHaveBeenCalledTimes(4); // Did not trigger after unsub
    });

    it('should dispatch and receive flux:insert-citation event', () => {
      const listener = vi.fn();
      const unsub = EditorEventBus.on('flux:insert-citation', listener);

      EditorEventBus.emit('flux:insert-citation', { bibKey: 'knuth1984' });
      expect(listener).toHaveBeenCalledWith({ bibKey: 'knuth1984' });

      unsub();
    });
  });

  describe('Lossless Round-Trip Conversion across Mode Switches', () => {
    it('should preserve headings, bold, italic, and lists when switching to Visual and back to Source', () => {
      const source = `\\section{Introduction}
This is \\textbf{bold} and \\textit{italic} text.

\\begin{itemize}
  \\item First bullet
  \\item Second bullet
\\end{itemize}`;

      // Convert to HTML for Visual Mode
      const html = latexToHtml(source);
      expect(html).toContain('Introduction');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>First bullet</li>');

      // Convert back to LaTeX for Source Mode
      const restored = htmlToLatex(html, source);
      expect(restored).toContain('\\section{Introduction}');
      expect(restored).toContain('\\textbf{bold}');
      expect(restored).toContain('\\textit{italic}');
      expect(restored).toContain('\\begin{itemize}');
      expect(restored).toContain('\\item First bullet');
      expect(restored).toContain('\\end{itemize}');
    });

    it('should preserve complex math formulas and environments through conversion', () => {
      const mathSource = `\\begin{equation}
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
\\end{equation}

Inline equation $E = mc^2$ in paragraph.`;

      const html = latexToHtml(mathSource);
      expect(html).toContain('latex-math-block');
      expect(html).toContain('latex-math-inline');

      const restored = htmlToLatex(html, mathSource);
      expect(restored).toContain('\\begin{equation}');
      expect(restored).toContain('\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}');
      expect(restored).toContain('\\end{equation}');
      expect(restored).toContain('$E = mc^2$');
    });

    it('should preserve protected environments (figure, table, tikz) untouched', () => {
      const protectedSource = `\\begin{figure}[htbp]
\\centering
\\includegraphics[width=0.8\\textwidth]{diagram.png}
\\caption{System Architecture Diagram}
\\label{fig:arch}
\\end{figure}`;

      const html = latexToHtml(protectedSource);
      expect(html).toContain('latex-protected-block');

      const restored = htmlToLatex(html, protectedSource);
      expect(restored).toContain('\\begin{figure}[htbp]');
      expect(restored).toContain('\\includegraphics[width=0.8\\textwidth]{diagram.png}');
      expect(restored).toContain('\\caption{System Architecture Diagram}');
      expect(restored).toContain('\\label{fig:arch}');
      expect(restored).toContain('\\end{figure}');
    });
  });
});
