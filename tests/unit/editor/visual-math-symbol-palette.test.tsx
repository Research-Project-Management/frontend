import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import {
  VisualMathSymbolPalette,
  MATH_SYMBOLS,
  type VisualMathSymbolPaletteProps,
} from '@/features/editor/ui/editor/visual/modals/VisualMathSymbolPalette';

describe('VisualMathSymbolPalette Component', () => {
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
});
