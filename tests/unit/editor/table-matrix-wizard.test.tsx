import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import {
  generateLatexTable,
  parseLatexTabular,
  parseDelimitedTextToGrid,
  generateLatexMatrix,
  parseLatexMatrix,
  generateMatrixPreset,
  sanitizeTableCell,
  unescapeTableCell,
} from '@/features/editor/domain/latex/table-matrix';
import { TableWizardModal } from '@/features/editor/ui/modals/TableWizardModal';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Visual Table & Matrix Wizard (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = '';
    document.querySelectorAll('[aria-hidden]').forEach((el) => {
      el.removeAttribute('aria-hidden');
    });
  });

  // ─── 1. Domain Utilities: Table Generation & Parsing ──────────────────────

  describe('Table Domain Utilities', () => {
    it('generates academic Booktabs LaTeX table with caption, label, and alignments', () => {
      const latex = generateLatexTable({
        rows: 2,
        cols: 3,
        headers: ['Model', 'Accuracy', 'Latency'],
        data: [
          ['BERT', '91.2%', '15ms'],
          ['Flux-AI', '98.5%', '8ms'],
        ],
        alignments: ['l', 'c', 'r'],
        style: 'booktabs',
        caption: 'Performance comparison',
        label: 'tab:models',
        placement: 'htbp',
        centering: true,
        hasHeaderRow: true,
      });

      expect(latex).toContain('\\begin{table}[htbp]');
      expect(latex).toContain('\\centering');
      expect(latex).toContain('\\caption{Performance comparison}');
      expect(latex).toContain('\\label{tab:models}');
      expect(latex).toContain('\\begin{tabular}{lcr}');
      expect(latex).toContain('\\toprule');
      expect(latex).toContain('Model & Accuracy & Latency \\\\');
      expect(latex).toContain('\\midrule');
      expect(latex).toContain('BERT & 91.2\\% & 15ms \\\\');
      expect(latex).toContain('Flux-AI & 98.5\\% & 8ms \\\\');
      expect(latex).toContain('\\bottomrule');
      expect(latex).toContain('\\end{tabular}');
      expect(latex).toContain('\\end{table}');
    });

    it('generates Bordered LaTeX table with vertical bars and \\hline', () => {
      const latex = generateLatexTable({
        rows: 2,
        cols: 2,
        headers: ['Input', 'Output'],
        data: [
          ['x_1', 'y_1'],
          ['x_2', 'y_2'],
        ],
        alignments: ['c', 'c'],
        style: 'bordered',
        placement: '!t',
        centering: false,
        hasHeaderRow: true,
      });

      expect(latex).toContain('\\begin{table}[!t]');
      expect(latex).not.toContain('\\centering');
      expect(latex).toContain('\\begin{tabular}{|c|c|}');
      expect(latex).toContain('\\hline');
      expect(latex).toContain('Input & Output \\\\');
      expect(latex).toContain('x\\_1 & y\\_1 \\\\');
      expect(latex).toContain('x\\_2 & y\\_2 \\\\');
      expect(latex).toContain('\\end{tabular}');
    });

    it('sanitizes special characters but preserves inline math', () => {
      expect(sanitizeTableCell('100% & $50_000')).toBe('100\\% \\& \\$50\\_000');
      expect(sanitizeTableCell('$x^2 + y_i$')).toBe('$x^2 + y_i$');
      expect(unescapeTableCell('100\\% \\& \\$50\\_000')).toBe('100% & $50_000');
    });

    it('reverse-parses LaTeX tabular and table environments back into visual grid', () => {
      const sampleLatex = `
\\begin{table}[!ht]
  \\centering
  \\caption{Experimental Benchmark}
  \\label{tab:exp}
  \\begin{tabular}{l c r}
    \\toprule
    Method & Precision & Recall \\\\
    \\midrule
    Baseline & 0.81 & 0.75 \\\\
    Proposed & 0.94 & 0.91 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}
      `.trim();

      const parsed = parseLatexTabular(sampleLatex);
      expect(parsed).not.toBeNull();
      expect(parsed?.cols).toBe(3);
      expect(parsed?.rows).toBe(2);
      expect(parsed?.style).toBe('booktabs');
      expect(parsed?.alignments).toEqual(['l', 'c', 'r']);
      expect(parsed?.caption).toBe('Experimental Benchmark');
      expect(parsed?.label).toBe('tab:exp');
      expect(parsed?.placement).toBe('!ht');
      expect(parsed?.centering).toBe(true);
      expect(parsed?.headers).toEqual(['Method', 'Precision', 'Recall']);
      expect(parsed?.data[0]).toEqual(['Baseline', '0.81', '0.75']);
      expect(parsed?.data[1]).toEqual(['Proposed', '0.94', '0.91']);
    });

    it('parses Excel TSV and CSV input into structured headers and data', () => {
      const tsvInput = `Col A\tCol B\tCol C\nVal 1\tVal 2\tVal 3\nVal 4\tVal 5\tVal 6`;
      const tsvResult = parseDelimitedTextToGrid(tsvInput, true);

      expect(tsvResult.cols).toBe(3);
      expect(tsvResult.rows).toBe(2);
      expect(tsvResult.headers).toEqual(['Col A', 'Col B', 'Col C']);
      expect(tsvResult.data[0]).toEqual(['Val 1', 'Val 2', 'Val 3']);

      const csvInput = `"Item, Name",Price,Qty\n"Widget, Standard",19.99,5`;
      const csvResult = parseDelimitedTextToGrid(csvInput, true);

      expect(csvResult.cols).toBe(3);
      expect(csvResult.headers).toEqual(['Item, Name', 'Price', 'Qty']);
      expect(csvResult.data[0]).toEqual(['Widget, Standard', '19.99', '5']);
    });
  });

  // ─── 2. Domain Utilities: Matrix Generation & Parsing ─────────────────────

  describe('Matrix Domain Utilities', () => {
    it('generates standard math matrices: pmatrix, bmatrix, vmatrix', () => {
      const cells = [
        ['1', '2'],
        ['3', '4'],
      ];

      const pmat = generateLatexMatrix({
        type: 'pmatrix',
        rows: 2,
        cols: 2,
        cells,
        wrapper: 'display',
      });
      expect(pmat).toContain('\\[\n\\begin{pmatrix}\n  1 & 2 \\\\\n  3 & 4\n\\end{pmatrix}\n\\]');

      const bmat = generateLatexMatrix({
        type: 'bmatrix',
        rows: 2,
        cols: 2,
        cells,
        wrapper: 'inline',
      });
      expect(bmat).toContain('$\\begin{bmatrix}\n  1 & 2 \\\\\n  3 & 4\n\\end{bmatrix}$');

      const eqmat = generateLatexMatrix({
        type: 'vmatrix',
        rows: 2,
        cols: 2,
        cells,
        wrapper: 'equation',
        equationLabel: 'eq:det_A',
      });
      expect(eqmat).toContain('\\begin{equation}\n\\begin{vmatrix}\n  1 & 2 \\\\\n  3 & 4\n\\end{vmatrix}\n  \\label{eq:det_A}\n\\end{equation}');
    });

    it('generates matrix presets (Identity, Zero, Symbolic, Diagonal)', () => {
      const identity3x3 = generateMatrixPreset('identity', 3, 3);
      expect(identity3x3).toEqual([
        ['1', '0', '0'],
        ['0', '1', '0'],
        ['0', '0', '1'],
      ]);

      const zero2x2 = generateMatrixPreset('zero', 2, 2);
      expect(zero2x2).toEqual([
        ['0', '0'],
        ['0', '0'],
      ]);

      const symbolic2x2 = generateMatrixPreset('symbolic', 2, 2);
      expect(symbolic2x2).toEqual([
        ['a_{11}', 'a_{12}'],
        ['a_{21}', 'a_{22}'],
      ]);

      const diagonal3x3 = generateMatrixPreset('diagonal', 3, 3);
      expect(diagonal3x3).toEqual([
        ['d_{1}', '0', '0'],
        ['0', 'd_{2}', '0'],
        ['0', '0', 'd_{3}'],
      ]);
    });

    it('reverse-parses LaTeX matrix code into structured MatrixGrid', () => {
      const matrixCode = `
\\[
\\begin{bmatrix}
  1 & 0 & 0 \\\\
  0 & \\cos\\theta & -\\sin\\theta \\\\
  0 & \\sin\\theta & \\cos\\theta
\\end{bmatrix}
\\]
      `.trim();

      const parsed = parseLatexMatrix(matrixCode);
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('bmatrix');
      expect(parsed?.rows).toBe(3);
      expect(parsed?.cols).toBe(3);
      expect(parsed?.wrapper).toBe('display');
      expect(parsed?.cells[0]).toEqual(['1', '0', '0']);
      expect(parsed?.cells[1]).toEqual(['0', '\\cos\\theta', '-\\sin\\theta']);
      expect(parsed?.cells[2]).toEqual(['0', '\\sin\\theta', '\\cos\\theta']);
    });
  });

  // ─── 3. UI Component: TableWizardModal ────────────────────────────────────

  describe('TableWizardModal Interactive Component', () => {
    it('renders modal with initial Table Tab and interactive spreadsheet cells', () => {
      render(
        <TableWizardModal
          open={true}
          onOpenChange={vi.fn()}
          onInsert={vi.fn()}
        />
      );

      expect(screen.getByText('Visual LaTeX Table & Matrix Wizard')).toBeInTheDocument();
      expect(screen.getByText('Interactive Cell Editor (Click to edit text, Tab to move)')).toBeInTheDocument();
      expect(screen.getByText('Booktabs (Academic)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Metric')).toBeInTheDocument();
    });

    it('updates cell text and regenerates LaTeX code live', () => {
      render(
        <TableWizardModal
          open={true}
          onOpenChange={vi.fn()}
          onInsert={vi.fn()}
        />
      );

      // Find the first header input and change it
      const headerInput = screen.getByDisplayValue('Metric');
      fireEvent.change(headerInput, { target: { value: 'CustomMetric' } });

      // Code preview should reflect updated cell
      expect(screen.getByText(/CustomMetric/)).toBeInTheDocument();
    });

    it('adds row and column dynamically to the table', () => {
      render(
        <TableWizardModal
          open={true}
          onOpenChange={vi.fn()}
          onInsert={vi.fn()}
        />
      );

      const addColBtn = screen.getByRole('button', { name: /Add Column/i });
      fireEvent.click(addColBtn);

      expect(screen.getByText('3 rows × 4 cols')).toBeInTheDocument();

      const addRowBtn = screen.getByRole('button', { name: /Add Row/i });
      fireEvent.click(addRowBtn);

      expect(screen.getByText('4 rows × 4 cols')).toBeInTheDocument();
    });

    it('switches to Math Matrix tab, applies Identity preset, and inserts matrix', () => {
      const handleInsert = vi.fn();
      const handleOpenChange = vi.fn();

      render(
        <TableWizardModal
          open={true}
          onOpenChange={handleOpenChange}
          onInsert={handleInsert}
          initialTab="matrix"
        />
      );

      expect(screen.getByText('Matrix Bracket Style:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Identity \(I\)/i })).toBeInTheDocument();

      // Click Identity preset
      fireEvent.click(screen.getByRole('button', { name: /Identity \(I\)/i }));
      expect(toast.success).toHaveBeenCalledWith('Applied identity matrix preset');

      // Click Insert Matrix button
      const insertBtn = screen.getByRole('button', { name: /Insert Matrix/i });
      fireEvent.click(insertBtn);

      expect(handleInsert).toHaveBeenCalledWith(expect.stringContaining('\\begin{pmatrix}'));
      expect(toast.success).toHaveBeenCalledWith('Matrix inserted into document');
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('copies LaTeX code to clipboard when "Copy Code" is clicked', async () => {
      render(
        <TableWizardModal
          open={true}
          onOpenChange={vi.fn()}
          onInsert={vi.fn()}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /Copy Code/i });
      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('\\begin{table}'));
      expect(toast.info).toHaveBeenCalledWith('LaTeX code copied to clipboard');
    });

    it('auto-parses initial LaTeX snippet into visual editor when pre-populated', () => {
      const sampleLatex = `
\\begin{table}[htbp]
  \\centering
  \\caption{Preloaded Table}
  \\label{tab:preloaded}
  \\begin{tabular}{cc}
    \\toprule
    Alpha & Beta \\\\
    \\midrule
    10 & 20 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}
      `.trim();

      render(
        <TableWizardModal
          open={true}
          onOpenChange={vi.fn()}
          onInsert={vi.fn()}
          initialLatex={sampleLatex}
        />
      );

      expect(screen.getByDisplayValue('Preloaded Table')).toBeInTheDocument();
      expect(screen.getByDisplayValue('tab:preloaded')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
    });
  });
});
