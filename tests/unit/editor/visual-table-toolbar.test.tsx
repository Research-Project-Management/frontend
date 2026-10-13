import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import {
  VisualTableToolbar,
  type VisualTableToolbarProps,
} from '@/features/editor/ui/editor/visual/toolbars/VisualTableToolbar';

describe('VisualTableToolbar Component & Visual Table Matrix Editing', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps: VisualTableToolbarProps = {
    position: { top: 120, left: 200 },
    caption: 'Sample Performance Table',
    label: 'tab:sample',
    columnAlignment: 'center',
    rowIndex: 1,
    colIndex: 2,
    totalRows: 3,
    totalCols: 4,
    onAddRowAbove: vi.fn(),
    onAddRowBelow: vi.fn(),
    onDeleteRow: vi.fn(),
    onAddColumnLeft: vi.fn(),
    onAddColumnRight: vi.fn(),
    onDeleteColumn: vi.fn(),
    onAlignColumn: vi.fn(),
    onUpdateMetadata: vi.fn(),
    onDeleteTable: vi.fn(),
    onClose: vi.fn(),
  };

  describe('1. Toolbar Rendering & UI Elements', () => {
    it('renders matrix position indicator with correct row and column values', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      expect(screen.getByRole('toolbar', { name: /Table Matrix Toolbar/i })).toBeInTheDocument();
      // rowIndex: 1 -> R2, colIndex: 2 -> C3
      expect(screen.getByText('R2/3 : C3/4')).toBeInTheDocument();
    });

    it('renders all structural buttons with accessible labels', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Add row above/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add row below/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete row/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add column left/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add column right/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete column/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Align column left/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Align column center/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Align column right/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Toggle caption and label editor/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete table/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close table toolbar/i })).toBeInTheDocument();
    });

    it('highlights active column alignment', () => {
      const { rerender } = render(<VisualTableToolbar {...defaultProps} columnAlignment="left" />);
      const leftBtn = screen.getByRole('button', { name: /Align column left/i });
      expect(leftBtn.className).toContain('bg-primary/15');

      rerender(<VisualTableToolbar {...defaultProps} columnAlignment="right" />);
      const rightBtn = screen.getByRole('button', { name: /Align column right/i });
      expect(rightBtn.className).toContain('bg-primary/15');
    });
  });

  describe('2. Button Actions & Callbacks', () => {
    it('calls row manipulation callbacks on button clicks', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Add row above/i }));
      expect(defaultProps.onAddRowAbove).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Add row below/i }));
      expect(defaultProps.onAddRowBelow).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Delete row/i }));
      expect(defaultProps.onDeleteRow).toHaveBeenCalledTimes(1);
    });

    it('calls column manipulation callbacks on button clicks', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Add column left/i }));
      expect(defaultProps.onAddColumnLeft).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Add column right/i }));
      expect(defaultProps.onAddColumnRight).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Delete column/i }));
      expect(defaultProps.onDeleteColumn).toHaveBeenCalledTimes(1);
    });

    it('calls onAlignColumn with corresponding align values', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Align column left/i }));
      expect(defaultProps.onAlignColumn).toHaveBeenCalledWith('left');

      fireEvent.click(screen.getByRole('button', { name: /Align column center/i }));
      expect(defaultProps.onAlignColumn).toHaveBeenCalledWith('center');

      fireEvent.click(screen.getByRole('button', { name: /Align column right/i }));
      expect(defaultProps.onAlignColumn).toHaveBeenCalledWith('right');
    });

    it('calls onDeleteTable and onClose callbacks', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Delete table/i }));
      expect(defaultProps.onDeleteTable).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Close table toolbar/i }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Metadata Editing (Caption & Label)', () => {
    it('toggles metadata form, edits caption and label, and triggers onUpdateMetadata', () => {
      render(<VisualTableToolbar {...defaultProps} />);

      // Initially form is hidden
      expect(screen.queryByLabelText(/Table caption input/i)).toBeNull();

      // Open metadata form
      fireEvent.click(screen.getByRole('button', { name: /Toggle caption and label editor/i }));
      const captionInput = screen.getByLabelText(/Table caption input/i);
      const labelInput = screen.getByLabelText(/Table label input/i);
      expect(captionInput).toBeInTheDocument();
      expect(labelInput).toBeInTheDocument();

      // Modify values
      fireEvent.change(captionInput, { target: { value: 'Updated Benchmark Results' } });
      fireEvent.change(labelInput, { target: { value: 'tab:benchmark_res' } });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Apply Metadata/i }));

      expect(defaultProps.onUpdateMetadata).toHaveBeenCalledWith(
        'Updated Benchmark Results',
        'tab:benchmark_res'
      );
      // Form closes after saving
      expect(screen.queryByLabelText(/Table caption input/i)).toBeNull();
    });
  });
});
