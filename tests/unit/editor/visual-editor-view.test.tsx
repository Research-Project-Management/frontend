import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { VisualEditorView } from '@/features/editor/ui/features/editor/VisualEditorView';
import { useSettingsStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/domain/latex/latex-structure';
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/coordinators/command-bus';

describe('VisualEditorView (Overleaf Visual Mode Parity)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ editorMode: 'visual' });
    document.execCommand = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const sampleLatex = [
    '\\section{Quantum Theory}',
    'This is a \\textbf{fundamental} paper on relativity.',
    'The famous relation is $E = mc^2$ by Einstein \\cite{einstein1905}.',
    '\\[',
    '\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J}',
    '\\]',
    '\\begin{figure}[h]',
    '\\centering',
    '\\includegraphics{diagram.png}',
    '\\caption{System architecture}',
    '\\end{figure}',
    '\\begin{lstlisting}[language=Python]',
    '# System architecture',
    '\\end{lstlisting}',
  ].join('\n');

  describe('1. Render Surface & Typography', () => {
    it('should render section headings, bold text, math, and citations into visual DOM elements', () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={vi.fn()}
        />
      );

      // Section heading
      const heading = container.querySelector('h1, h2');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toContain('Quantum Theory');

      // Bold text
      const bold = container.querySelector('strong');
      expect(bold).toBeTruthy();
      expect(bold?.textContent).toBe('fundamental');

      // Inline math
      const inlineMath = container.querySelector('.latex-math-inline');
      expect(inlineMath).toBeTruthy();
      const rawInlineMath = decodeURIComponent(inlineMath?.getAttribute('data-math') || '');
      expect(rawInlineMath).toBe('E = mc^2');

      // Display math
      const displayMath = container.querySelector('.latex-math-block');
      expect(displayMath).toBeTruthy();
      const rawDisplayMath = decodeURIComponent(displayMath?.getAttribute('data-math') || '');
      expect(rawDisplayMath).toContain('\\nabla \\times \\mathbf{B}');

      // Citation chip
      const citeChip = container.querySelector('.latex-citation-chip');
      expect(citeChip).toBeTruthy();
      expect(citeChip?.getAttribute('data-cite')).toBe('einstein1905');
      expect(citeChip?.textContent).toContain('einstein1905');

      // Protected block (listing)
      const protectedBlock = container.querySelector('.latex-protected-block');
      expect(protectedBlock).toBeTruthy();
      const rawProtected = decodeURIComponent(protectedBlock?.getAttribute('data-raw-latex') || '');
      expect(rawProtected).toContain('\\begin{lstlisting}');

      // Interactive figure wrapper
      const figure = container.querySelector('figure.latex-figure-wrapper');
      expect(figure).toBeTruthy();
      expect(figure?.getAttribute('data-src')).toBe('diagram.png');
      expect(figure?.textContent).toContain('System architecture');
    });
  });

  describe('2. Click-to-Edit Math Popover & Live Preview', () => {
    it('should open math editor popover on clicking inline math element and apply updates', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={handleChange}
        />
      );

      const inlineMath = container.querySelector('.latex-math-inline') as HTMLElement;
      expect(inlineMath).toBeTruthy();

      // Click on math formula
      fireEvent.click(inlineMath);

      // Modal should appear
      expect(screen.getByText(/Edit LaTeX Math/i)).toBeInTheDocument();
      const input = screen.getByPlaceholderText(/e\.g\./i) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('E = mc^2');

      // Change equation
      fireEvent.change(input, { target: { value: 'E = h\\nu' } });
      expect(input.value).toBe('E = h\\nu');

      // Click Apply Changes button
      const applyBtn = screen.getByRole('button', { name: /Apply Changes/i });
      fireEvent.click(applyBtn);

      // Modal closes
      expect(screen.queryByText(/Edit LaTeX Math/i)).toBeNull();

      // Math node updated
      const updatedMath = container.querySelector('.latex-math-inline');
      expect(decodeURIComponent(updatedMath?.getAttribute('data-math') || '')).toBe('E = h\\nu');

      // onChange callback fired with new equation
      expect(handleChange).toHaveBeenCalled();
      const latestLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(latestLatex).toContain('E = h\\nu');
    });

    it('should delete formula and update LaTeX when clicking Delete Formula button', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={handleChange}
        />
      );

      const inlineMath = container.querySelector('.latex-math-inline') as HTMLElement;
      fireEvent.click(inlineMath);

      const deleteBtn = screen.getByRole('button', { name: /Delete Formula/i });
      fireEvent.click(deleteBtn);

      expect(screen.queryByText(/Edit LaTeX Math/i)).toBeNull();
      expect(container.querySelector('.latex-math-inline')).toBeNull();
      expect(handleChange).toHaveBeenCalled();
      const latestLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(latestLatex).not.toContain('E = mc^2');
    });
  });

  describe('3. Protected Block Editor Modal', () => {
    it('should open raw LaTeX editor modal on clicking edit on protected environment', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={handleChange}
        />
      );

      const editBtn = container.querySelector('.latex-protected-edit-btn') as HTMLElement;
      expect(editBtn).toBeTruthy();

      fireEvent.click(editBtn);

      expect(screen.getByText(/Edit Protected LaTeX Environment/i)).toBeInTheDocument();
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
      expect(textarea.value).toContain('\\begin{lstlisting}');

      // Update protected block raw LaTeX
      fireEvent.change(textarea, {
        target: { value: '\\begin{lstlisting}[language=Python]\n# Updated diagram\n\\end{lstlisting}' },
      });

      // Save changes
      const saveBtn = screen.getByRole('button', { name: /Save Environment/i });
      fireEvent.click(saveBtn);

      expect(screen.queryByText(/Edit Protected LaTeX Environment/i)).toBeNull();
      expect(handleChange).toHaveBeenCalled();
      const latestLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(latestLatex).toContain('Updated diagram');
    });
  });

  describe('4. Citation Picker Dialog Delegation', () => {
    it('should dispatch citation-picker dialog event when citation chip is clicked', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={vi.fn()}
        />
      );

      const citeChip = container.querySelector('.latex-citation-chip') as HTMLElement;
      expect(citeChip).toBeTruthy();

      fireEvent.click(citeChip);

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'citation-picker',
        payload: { initialQuery: 'einstein1905' },
      });
    });
  });

  describe('5. Formatting Commands Execution & Event Bus', () => {
    it('should delegate bold and italic commands via document.execCommand', () => {
      render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={vi.fn()}
        />
      );

      EditorEventBus.emit('flux:visual-command', { command: 'bold' });
      expect(document.execCommand).toHaveBeenCalledWith('bold', false);

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'italic' });
      expect(document.execCommand).toHaveBeenCalledWith('italic', false);

      EditorEventBus.emit('flux:visual-command', { command: 'heading', level: 2 });
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'h2');
    });

    it('should insert citation chip when flux:insert-citation event is emitted', () => {
      render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={vi.fn()}
        />
      );

      EditorEventBus.emit('flux:insert-citation', { bibKey: 'newton1687' });
      expect(document.execCommand).toHaveBeenCalledWith(
        'insertHTML',
        false,
        expect.stringContaining('[@newton1687]')
      );
    });
  });

  describe('6. Active Editor Engine Adapter', () => {
    it('should register engine adapter with getContent and setContent methods', () => {
      render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={vi.fn()}
        />
      );

      const engine = getActiveEditorEngine();
      expect(engine).toBeTruthy();
      const content = engine?.getContent();
      expect(content).toContain('Quantum Theory');

      engine?.setContent('\\section{New Document}\nHello world.');
      const newContent = engine?.getContent();
      expect(newContent).toContain('New Document');
    });
  });

  describe('7. Keyboard Shortcuts', () => {
    it('should toggle editor mode on Ctrl+Shift+V', () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={vi.fn()}
        />
      );

      const surface = container.querySelector('.visual-editor-surface') as HTMLElement;
      expect(useSettingsStore.getState().editorMode).toBe('visual');

      fireEvent.keyDown(surface, { key: 'V', shiftKey: true, ctrlKey: true });
      expect(useSettingsStore.getState().editorMode).toBe('code');
    });
  });

  describe('8. Floating Selection Bubble Menu (Medium / Notion Style)', () => {
    it('should open bubble menu on selection, allow formatting, and dismiss on Escape', async () => {
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value="\\section{Test}\nThis is selected text for formatting."
          onChange={vi.fn()}
        />
      );

      const surface = container.querySelector('.visual-editor-surface') as HTMLElement;
      expect(surface).toBeTruthy();

      const textNode = surface.querySelector('p')?.firstChild || surface.firstChild;

      const mockRange = {
        getBoundingClientRect: () => ({
          top: 200,
          bottom: 220,
          left: 150,
          right: 350,
          width: 200,
          height: 20,
        }),
      };

      const mockSelection = {
        isCollapsed: false,
        rangeCount: 1,
        anchorNode: textNode,
        focusNode: textNode,
        toString: () => 'selected text',
        getRangeAt: () => mockRange,
      };

      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      // Trigger selectionchange
      fireEvent(document, new Event('selectionchange'));

      await waitFor(() => {
        expect(screen.getByRole('toolbar', { name: /selection bubble menu/i })).toBeInTheDocument();
      });

      // Format bold from bubble menu
      const boldBtn = screen.getByRole('button', { name: /format bold/i });
      fireEvent.click(boldBtn);
      expect(document.execCommand).toHaveBeenCalledWith('bold', false);

      // Convert to math from bubble menu
      const mathBtn = screen.getByRole('button', { name: /convert to math formula/i });
      fireEvent.click(mathBtn);
      expect(document.execCommand).toHaveBeenCalledWith(
        'insertHTML',
        false,
        expect.stringContaining('latex-math-inline')
      );

      // Press Escape on surface to dismiss bubble menu
      fireEvent.keyDown(surface, { key: 'Escape' });
      expect(screen.queryByRole('toolbar', { name: /selection bubble menu/i })).not.toBeInTheDocument();
    });
  });

  describe('9. Interactive Figure WYSIWYG Inserter & Floating Toolbar (Overleaf Parity)', () => {
    it('should open figure floating toolbar on clicking figure element, allow width & metadata update, and delete', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="paper.tex"
          value={sampleLatex}
          onChange={handleChange}
        />
      );

      const figure = container.querySelector('figure.latex-figure-wrapper') as HTMLElement;
      expect(figure).toBeTruthy();

      // Click on figure element to open floating toolbar
      fireEvent.click(figure);

      await waitFor(() => {
        expect(screen.getByRole('toolbar', { name: /figure floating toolbar/i })).toBeInTheDocument();
      });

      // Change width to 50% via preset button
      const btn50 = screen.getByRole('button', { name: /width 50%/i });
      fireEvent.click(btn50);

      expect(decodeURIComponent(figure.getAttribute('data-width') || '')).toBe('0.5\\linewidth');
      expect(figure.querySelector('img')?.style.width).toBe('50%');
      expect(handleChange).toHaveBeenCalled();
      let latestLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(latestLatex).toContain('width=0.5\\linewidth');

      // Update figure metadata (caption and label)
      const settingsBtn = screen.getByRole('button', { name: /edit figure caption and label/i });
      fireEvent.click(settingsBtn);

      const captionInput = screen.getByRole('textbox', { name: /figure caption input/i });
      fireEvent.change(captionInput, { target: { value: 'Updated system architecture' } });

      const saveMetadataBtn = screen.getByRole('button', { name: /save metadata/i });
      fireEvent.click(saveMetadataBtn);

      expect(decodeURIComponent(figure.getAttribute('data-caption') || '')).toBe('Updated system architecture');
      expect(handleChange).toHaveBeenCalled();
      latestLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(latestLatex).toContain('\\caption{Updated system architecture}');

      // Delete figure
      const deleteBtn = screen.getByRole('button', { name: /delete figure/i });
      fireEvent.click(deleteBtn);

      expect(screen.queryByRole('toolbar', { name: /figure floating toolbar/i })).not.toBeInTheDocument();
      expect(container.querySelector('figure.latex-figure-wrapper')).toBeNull();
      expect(handleChange).toHaveBeenCalled();
      latestLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(latestLatex).not.toContain('diagram.png');
    });
  });
});


