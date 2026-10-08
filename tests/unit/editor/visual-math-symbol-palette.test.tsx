import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import {
  VisualMathSymbolPalette,
  MATH_SYMBOLS,
  type VisualMathSymbolPaletteProps,
} from '@/features/editor/ui/features/editor/VisualMathSymbolPalette';
import { VisualEditorView } from '@/features/editor/ui/features/editor/VisualEditorView';
import { useSettingsStore } from '@/features/editor/store';

describe('VisualMathSymbolPalette & Math Modal Integration', () => {
  beforeEach(() => {
    useSettingsStore.setState({ editorMode: 'visual' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. Palette Component Rendering & Category Navigation', () => {
    it('renders category tabs and search input', () => {
      render(<VisualMathSymbolPalette onInsertSymbol={vi.fn()} />);

      expect(screen.getByRole('region', { name: /KaTeX Quick-Symbol Palette/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Basic' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Greek' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Calculus' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Relations' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Matrices' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Filter symbols/i)).toBeInTheDocument();
    });

    it('displays basic symbols by default and switches to Greek letters on tab click', () => {
      render(<VisualMathSymbolPalette onInsertSymbol={vi.fn()} />);

      // Fraction is in basic category
      expect(screen.getByRole('button', { name: /Insert Fraction/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Square Root/i })).toBeInTheDocument();

      // Switch to Greek tab
      fireEvent.click(screen.getByRole('tab', { name: 'Greek' }));

      expect(screen.getByRole('button', { name: /Insert alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert beta/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Insert gamma' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Insert Delta' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Insert Omega' })).toBeInTheDocument();
    });

    it('switches to Calculus tab and displays integrals and summations', () => {
      render(<VisualMathSymbolPalette onInsertSymbol={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Calculus' }));

      expect(screen.getByRole('button', { name: /Insert Definite Integral/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Summation/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Limit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Nabla/i })).toBeInTheDocument();
    });

    it('switches to Relations tab and displays arrows and set operations', () => {
      render(<VisualMathSymbolPalette onInsertSymbol={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Relations' }));

      expect(screen.getByRole('button', { name: /Insert Right Arrow/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Implies/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Element of/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Union/i })).toBeInTheDocument();
    });

    it('switches to Matrices tab and displays matrix and cases environments', () => {
      render(<VisualMathSymbolPalette onInsertSymbol={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Matrices' }));

      expect(screen.getByRole('button', { name: /Insert 2x2 Matrix/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Bracket Matrix/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Piecewise Cases/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Insert Aligned Equations/i })).toBeInTheDocument();
    });

    it('filters symbols by search query across all categories', () => {
      render(<VisualMathSymbolPalette onInsertSymbol={vi.fn()} />);

      const searchInput = screen.getByPlaceholderText(/Filter symbols/i);
      fireEvent.change(searchInput, { target: { value: 'theta' } });

      expect(screen.getByRole('button', { name: 'Insert theta' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Insert Fraction/i })).toBeNull();

      // Non-existent search
      fireEvent.change(searchInput, { target: { value: 'nonexistentquery123' } });
      expect(screen.getByText(/No symbols found matching/i)).toBeInTheDocument();
    });

    it('invokes onInsertSymbol with the correct LaTeX string when clicked', () => {
      const handleInsert = vi.fn();
      render(<VisualMathSymbolPalette onInsertSymbol={handleInsert} />);

      const fracBtn = screen.getByRole('button', { name: /Insert Fraction/i });
      fireEvent.click(fracBtn);

      expect(handleInsert).toHaveBeenCalledWith('\\frac{a}{b}');
    });
  });

  describe('2. VisualEditorView Math Modal Integration', () => {
    const mathLatex = [
      '\\section{Math Demonstration}',
      'The mass-energy relation is $E = mc^2$ in relativity.',
    ].join('\n');

    it('opens math editor modal with KaTeX preview and quick-symbol palette on click', () => {
      const { container } = render(
        <VisualEditorView filePath="math.tex" value={mathLatex} onChange={vi.fn()} />
      );

      const mathEl = container.querySelector('.latex-math-inline');
      expect(mathEl).toBeTruthy();
      fireEvent.click(mathEl!);

      // Modal is open
      expect(screen.getByText(/Edit LaTeX Math \(Inline Formula\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/LaTeX equation input/i)).toHaveValue('E = mc^2');
      // Palette is present
      expect(screen.getByRole('region', { name: /KaTeX Quick-Symbol Palette/i })).toBeInTheDocument();
    });

    it('toggles the quick symbol palette with the header button', () => {
      const { container } = render(
        <VisualEditorView filePath="math.tex" value={mathLatex} onChange={vi.fn()} />
      );

      const mathEl = container.querySelector('.latex-math-inline');
      fireEvent.click(mathEl!);

      const toggleBtn = screen.getByRole('button', { name: /Toggle math symbol palette/i });
      expect(screen.getByRole('region', { name: /KaTeX Quick-Symbol Palette/i })).toBeInTheDocument();

      // Click to hide
      fireEvent.click(toggleBtn);
      expect(screen.queryByRole('region', { name: /KaTeX Quick-Symbol Palette/i })).toBeNull();

      // Click to show again
      fireEvent.click(toggleBtn);
      expect(screen.getByRole('region', { name: /KaTeX Quick-Symbol Palette/i })).toBeInTheDocument();
    });

    it('inserts clicked symbol into the equation and updates KaTeX live preview', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView filePath="math.tex" value={mathLatex} onChange={handleChange} />
      );

      const mathEl = container.querySelector('.latex-math-inline');
      fireEvent.click(mathEl!);

      // Click Greek tab and insert alpha
      fireEvent.click(screen.getByRole('tab', { name: 'Greek' }));
      const alphaBtn = screen.getByRole('button', { name: /Insert alpha/i });
      fireEvent.click(alphaBtn);

      const input = screen.getByLabelText(/LaTeX equation input/i) as HTMLInputElement;
      expect(input.value).toContain('\\alpha');

      // Click Apply Changes
      fireEvent.click(screen.getByRole('button', { name: /Apply Changes/i }));

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const nextLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        expect(nextLatex).toContain('\\alpha');
      });
    });

    it('deletes math formula on Delete Formula click', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView filePath="math.tex" value={mathLatex} onChange={handleChange} />
      );

      const mathEl = container.querySelector('.latex-math-inline');
      fireEvent.click(mathEl!);

      fireEvent.click(screen.getByRole('button', { name: /Delete Formula/i }));

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const nextLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        expect(nextLatex).not.toContain('$E = mc^2$');
        expect(container.querySelector('.latex-math-inline')).toBeNull();
      });
    });

    it('closes modal on Escape key press or Cancel click', () => {
      const { container } = render(
        <VisualEditorView filePath="math.tex" value={mathLatex} onChange={vi.fn()} />
      );

      const mathEl = container.querySelector('.latex-math-inline');
      fireEvent.click(mathEl!);
      expect(screen.getByText(/Edit LaTeX Math/i)).toBeInTheDocument();

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      expect(screen.queryByText(/Edit LaTeX Math/i)).toBeNull();
    });
  });
});
