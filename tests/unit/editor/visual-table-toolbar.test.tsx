import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import {
  VisualTableToolbar,
  type VisualTableToolbarProps,
} from '@/features/editor/ui/features/editor/VisualTableToolbar';
import { VisualEditorView } from '@/features/editor/ui/features/editor/VisualEditorView';
import { useSettingsStore } from '@/features/editor/store';

describe('VisualTableToolbar Component & Visual Table Matrix Editing', () => {
  beforeEach(() => {
    useSettingsStore.setState({ editorMode: 'visual' });
  });

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

  describe('4. Full Integration with VisualEditorView', () => {
    const tableLatex = [
      '\\begin{table}[htbp]',
      '  \\centering',
      '  \\caption{Accuracy Benchmark}',
      '  \\label{tab:acc}',
      '  \\begin{tabular}{l c r}',
      '    \\toprule',
      '    Model & Baseline & FineTuned \\\\',
      '    \\midrule',
      '    BERT & 85.0 & 92.5 \\\\',
      '    GPT & 88.0 & 96.0 \\\\',
      '    \\bottomrule',
      '  \\end{tabular}',
      '\\end{table}',
    ].join('\n');

    it('opens table toolbar when clicking inside table cell', () => {
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={vi.fn()}
        />
      );

      const cell = container.querySelector('td');
      expect(cell).toBeTruthy();
      fireEvent.click(cell!);

      expect(screen.getByRole('toolbar', { name: /Table Matrix Toolbar/i })).toBeInTheDocument();
    });

    it('adds a row below when Add Row Below is clicked and updates LaTeX', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      const cell = container.querySelector('td');
      fireEvent.click(cell!);

      const addRowBelowBtn = screen.getByRole('button', { name: /Add row below/i });
      fireEvent.click(addRowBelowBtn);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        expect(lastCallLatex).toContain('\\begin{table}[htbp]');
        expect(lastCallLatex).toContain('\\begin{tabular}{l c r}');
        // The table now has 4 rows (1 header + 3 body rows)
        const rows = container.querySelectorAll('tr');
        expect(rows.length).toBe(4);
      });
    });

    it('adds a column right and updates LaTeX alignment specification', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      const cell = container.querySelector('td');
      fireEvent.click(cell!);

      const addColRightBtn = screen.getByRole('button', { name: /Add column right/i });
      fireEvent.click(addColRightBtn);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        // Now 4 columns with alignment spec
        expect(lastCallLatex).toContain('\\begin{tabular}{l c c r}');
        const firstRowCells = container.querySelector('tr')?.children;
        expect(firstRowCells?.length).toBe(4);
      });
    });

    it('changes column alignment to left and synchronizes to LaTeX', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      // Click middle column cell (col index 1)
      const row = container.querySelectorAll('tbody tr')[0];
      const middleCell = row.querySelectorAll('td')[1];
      fireEvent.click(middleCell);

      const alignLeftBtn = screen.getByRole('button', { name: /Align column left/i });
      fireEvent.click(alignLeftBtn);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        // Middle column changed from 'c' to 'l' -> "l l r"
        expect(lastCallLatex).toContain('\\begin{tabular}{l l r}');
      });
    });

    it('updates table caption and label metadata seamlessly', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      const cell = container.querySelector('td');
      fireEvent.click(cell!);

      // Open metadata editor
      fireEvent.click(screen.getByRole('button', { name: /Toggle caption and label editor/i }));
      const captionInput = screen.getByLabelText(/Table caption input/i);
      const labelInput = screen.getByLabelText(/Table label input/i);

      fireEvent.change(captionInput, { target: { value: 'New Test Results' } });
      fireEvent.change(labelInput, { target: { value: 'tab:new_test' } });
      fireEvent.click(screen.getByRole('button', { name: /Apply Metadata/i }));

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        expect(lastCallLatex).toContain('\\caption{New Test Results}');
        expect(lastCallLatex).toContain('\\label{tab:new_test}');
      });
    });

    it('deletes a row and updates LaTeX source', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      const firstTd = container.querySelector('tbody tr td');
      fireEvent.click(firstTd!);

      const deleteRowBtn = screen.getByRole('button', { name: /Delete row/i });
      fireEvent.click(deleteRowBtn);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        // Initially 2 body rows, now 1 body row remains
        const rows = container.querySelectorAll('tbody tr');
        expect(rows.length).toBe(1);
        expect(lastCallLatex).not.toContain('BERT & 85.0 & 92.5');
      });
    });

    it('deletes a column and updates LaTeX source', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      // Select first column (BERT)
      const firstTd = container.querySelector('tbody tr td');
      fireEvent.click(firstTd!);

      const deleteColBtn = screen.getByRole('button', { name: /Delete column/i });
      fireEvent.click(deleteColBtn);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        // 3 columns reduced to 2 columns -> "c r"
        expect(lastCallLatex).toContain('\\begin{tabular}{c r}');
        const firstRowCells = container.querySelector('tr')?.children;
        expect(firstRowCells?.length).toBe(2);
      });
    });

    it('deletes entire table on Delete Table click', async () => {
      const handleChange = vi.fn();
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={handleChange}
        />
      );

      const cell = container.querySelector('td');
      fireEvent.click(cell!);

      const deleteTableBtn = screen.getByRole('button', { name: /Delete table/i });
      fireEvent.click(deleteTableBtn);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
        const lastCallLatex = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
        expect(lastCallLatex).not.toContain('\\begin{table}');
        expect(container.querySelector('table')).toBeNull();
        expect(screen.queryByRole('toolbar', { name: /Table Matrix Toolbar/i })).toBeNull();
      });
    });

    it('closes toolbar on Escape key press', () => {
      const { container } = render(
        <VisualEditorView
          filePath="test.tex"
          value={tableLatex}
          onChange={vi.fn()}
        />
      );

      const cell = container.querySelector('td');
      fireEvent.click(cell!);
      expect(screen.getByRole('toolbar', { name: /Table Matrix Toolbar/i })).toBeInTheDocument();

      const surface = container.querySelector('.visual-editor-surface');
      fireEvent.keyDown(surface!, { key: 'Escape' });

      expect(screen.queryByRole('toolbar', { name: /Table Matrix Toolbar/i })).toBeNull();
    });
  });
});
