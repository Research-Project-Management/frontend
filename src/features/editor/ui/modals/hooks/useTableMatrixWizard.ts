'use client';

/**
 * useTableMatrixWizard.ts
 *
 * Dedicated State & Orchestration Hook for Table & Matrix Wizard (Overleaf Parity):
 * - Interactive Editable 2D Grid with cell-level editing and row/column additions/deletions.
 * - Tabular code generation: Booktabs, Bordered, Minimal.
 * - Math Matrix code generation: pmatrix, bmatrix, vmatrix, Bmatrix, Vmatrix, matrix.
 * - Excel / Google Sheets CSV/TSV data paste importer.
 * - Reverse-parser from existing LaTeX tabular & matrix snippets.
 * - Presets: Identity, Zero, Symbolic, Diagonal.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  type TableAlignment,
  type TableStyle,
  type MatrixType,
  type MatrixWrapper,
  generateLatexTable,
  parseLatexTabular,
  parseDelimitedTextToGrid,
  generateLatexMatrix,
  parseLatexMatrix,
  generateMatrixPreset,
} from '@/features/editor/domain/latex/table-matrix';

export interface UseTableMatrixWizardOptions {
  onInsert: (latexCode: string) => void;
  onClose: () => void;
  initialTab?: 'table' | 'matrix';
  initialLatex?: string;
}

export function useTableMatrixWizard({
  onInsert,
  onClose,
  initialTab = 'table',
  initialLatex = '',
}: UseTableMatrixWizardOptions) {
  const [tab, setTab] = useState<'table' | 'matrix'>(initialTab);

  // ─── 1. Table Grid State ────────────────────────────────────────────────────
  const [tableRows, setTableRows] = useState<number>(3);
  const [tableCols, setTableCols] = useState<number>(3);
  const [tableHeaders, setTableHeaders] = useState<string[]>([
    'Metric',
    'Baseline',
    'Proposed',
  ]);
  const [tableData, setTableData] = useState<string[][]>([
    ['Accuracy', '85.4%', '94.2%'],
    ['Precision', '0.82', '0.91'],
    ['F1-Score', '0.84', '0.93'],
  ]);
  const [tableAlignments, setTableAlignments] = useState<TableAlignment[]>([
    'l',
    'c',
    'c',
  ]);
  const [tableStyle, setTableStyle] = useState<TableStyle>('booktabs');
  const [caption, setCaption] = useState<string>('Performance comparison across models');
  const [label, setLabel] = useState<string>('tab:performance');
  const [placement, setPlacement] = useState<string>('htbp');
  const [centering, setCentering] = useState<boolean>(true);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);

  // Table hover state for 8x8 quick dimension picker
  const [hoverRows, setHoverRows] = useState<number>(0);
  const [hoverCols, setHoverCols] = useState<number>(0);

  // Table paste / import state
  const [pastedText, setPastedText] = useState<string>('');

  // ─── 2. Matrix Grid State ───────────────────────────────────────────────────
  const [matrixType, setMatrixType] = useState<MatrixType>('pmatrix');
  const [matrixRows, setMatrixRows] = useState<number>(3);
  const [matrixCols, setMatrixCols] = useState<number>(3);
  const [matrixCells, setMatrixCells] = useState<string[][]>([
    ['1', '0', '0'],
    ['0', '1', '0'],
    ['0', '0', '1'],
  ]);
  const [matrixWrapper, setMatrixWrapper] = useState<MatrixWrapper>('display');
  const [matrixEquationLabel, setMatrixEquationLabel] = useState<string>('eq:matrix_trans');

  // ─── 3. Initialize from selected LaTeX text (if available) ──────────────────
  useEffect(() => {
    if (!initialLatex || !initialLatex.trim()) return;

    // Check if initialLatex is a matrix
    const parsedMatrix = parseLatexMatrix(initialLatex);
    if (parsedMatrix) {
      setTab('matrix');
      setMatrixType(parsedMatrix.type);
      setMatrixRows(parsedMatrix.rows);
      setMatrixCols(parsedMatrix.cols);
      setMatrixCells(parsedMatrix.cells);
      setMatrixWrapper(parsedMatrix.wrapper);
      if (parsedMatrix.equationLabel) setMatrixEquationLabel(parsedMatrix.equationLabel);
      return;
    }

    // Check if initialLatex is a table
    const parsedTable = parseLatexTabular(initialLatex);
    if (parsedTable) {
      setTab('table');
      setTableRows(parsedTable.rows);
      setTableCols(parsedTable.cols);
      setTableHeaders(parsedTable.headers);
      setTableData(parsedTable.data);
      setTableAlignments(parsedTable.alignments);
      setTableStyle(parsedTable.style);
      if (parsedTable.caption) setCaption(parsedTable.caption);
      if (parsedTable.label) setLabel(parsedTable.label);
      if (parsedTable.placement) setPlacement(parsedTable.placement);
      setCentering(Boolean(parsedTable.centering));
      setHasHeaderRow(Boolean(parsedTable.hasHeaderRow));
    }
  }, [initialLatex]);

  // ─── 4. Table Grid Actions ──────────────────────────────────────────────────

  const setTableDimension = useCallback((rows: number, cols: number) => {
    const validRows = Math.max(1, Math.min(50, rows));
    const validCols = Math.max(1, Math.min(20, cols));

    setTableRows(validRows);
    setTableCols(validCols);

    // Resize headers
    setTableHeaders((prev) => {
      const next = [...prev];
      while (next.length < validCols) next.push(`Col ${next.length + 1}`);
      return next.slice(0, validCols);
    });

    // Resize alignments
    setTableAlignments((prev) => {
      const next = [...prev];
      while (next.length < validCols) next.push('c');
      return next.slice(0, validCols);
    });

    // Resize data cells
    setTableData((prev) => {
      const next = prev.map((row) => {
        const r = [...row];
        while (r.length < validCols) r.push('');
        return r.slice(0, validCols);
      });
      while (next.length < validRows) {
        next.push(Array(validCols).fill(''));
      }
      return next.slice(0, validRows);
    });
  }, []);

  const updateTableCell = useCallback((row: number, col: number, value: string) => {
    setTableData((prev) => {
      const next = prev.map((r, rIdx) => {
        if (rIdx !== row) return r;
        const newRow = [...r];
        newRow[col] = value;
        return newRow;
      });
      return next;
    });
  }, []);

  const updateTableHeader = useCallback((col: number, value: string) => {
    setTableHeaders((prev) => {
      const next = [...prev];
      next[col] = value;
      return next;
    });
  }, []);

  const toggleColumnAlignment = useCallback((col: number) => {
    const nextAlignMap: Record<TableAlignment, TableAlignment> = {
      l: 'c',
      c: 'r',
      r: 'l',
    };
    setTableAlignments((prev) => {
      const next = [...prev];
      const cur = next[col] || 'c';
      next[col] = nextAlignMap[cur];
      return next;
    });
  }, []);

  const setAllAlignments = useCallback((align: TableAlignment) => {
    setTableAlignments(Array(tableCols).fill(align));
  }, [tableCols]);

  const addTableRow = useCallback((afterIndex?: number) => {
    setTableData((prev) => {
      const newRow = Array(tableCols).fill('');
      const targetIdx = afterIndex !== undefined ? afterIndex + 1 : prev.length;
      const next = [...prev.slice(0, targetIdx), newRow, ...prev.slice(targetIdx)];
      setTableRows(next.length);
      return next;
    });
  }, [tableCols]);

  const removeTableRow = useCallback((index: number) => {
    setTableData((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setTableRows(next.length);
      return next;
    });
  }, []);

  const addTableColumn = useCallback((afterIndex?: number) => {
    const targetIdx = afterIndex !== undefined ? afterIndex + 1 : tableCols;
    const newColCount = tableCols + 1;
    setTableCols(newColCount);

    setTableHeaders((prev) => [
      ...prev.slice(0, targetIdx),
      `Col ${newColCount}`,
      ...prev.slice(targetIdx),
    ]);

    setTableAlignments((prev) => [
      ...prev.slice(0, targetIdx),
      'c',
      ...prev.slice(targetIdx),
    ]);

    setTableData((prev) =>
      prev.map((row) => [
        ...row.slice(0, targetIdx),
        '',
        ...row.slice(targetIdx),
      ])
    );
  }, [tableCols]);

  const removeTableColumn = useCallback((index: number) => {
    if (tableCols <= 1) return;
    const newColCount = tableCols - 1;
    setTableCols(newColCount);
    setTableHeaders((prev) => prev.filter((_, i) => i !== index));
    setTableAlignments((prev) => prev.filter((_, i) => i !== index));
    setTableData((prev) => prev.map((row) => row.filter((_, i) => i !== index)));
  }, [tableCols]);

  const importPastedData = useCallback(() => {
    if (!pastedText.trim()) return;

    // Check if pasted text is raw LaTeX
    const parsedLatex = parseLatexTabular(pastedText);
    if (parsedLatex) {
      setTableRows(parsedLatex.rows);
      setTableCols(parsedLatex.cols);
      setTableHeaders(parsedLatex.headers);
      setTableData(parsedLatex.data);
      setTableAlignments(parsedLatex.alignments);
      setTableStyle(parsedLatex.style);
      if (parsedLatex.caption) setCaption(parsedLatex.caption);
      if (parsedLatex.label) setLabel(parsedLatex.label);
      if (parsedLatex.placement) setPlacement(parsedLatex.placement);
      setCentering(Boolean(parsedLatex.centering));
      setHasHeaderRow(Boolean(parsedLatex.hasHeaderRow));
      toast.success('Imported LaTeX table into visual editor');
      setPastedText('');
      return;
    }

    // Parse delimited text (Excel/CSV)
    const { headers, data, cols, rows } = parseDelimitedTextToGrid(
      pastedText,
      hasHeaderRow
    );

    if (cols > 0 && (rows > 0 || headers.length > 0)) {
      setTableCols(cols);
      setTableRows(Math.max(rows, 1));
      setTableHeaders(headers);
      setTableData(data.length > 0 ? data : [Array(cols).fill('')]);
      setTableAlignments(Array(cols).fill('c'));
      toast.success(`Imported ${rows} rows and ${cols} columns`);
      setPastedText('');
    } else {
      toast.error('Could not parse table data');
    }
  }, [pastedText, hasHeaderRow]);

  // ─── 5. Matrix Grid Actions ─────────────────────────────────────────────────

  const setMatrixDimension = useCallback((rows: number, cols: number) => {
    const validRows = Math.max(1, Math.min(10, rows));
    const validCols = Math.max(1, Math.min(10, cols));

    setMatrixRows(validRows);
    setMatrixCols(validCols);

    setMatrixCells((prev) => {
      const next = prev.map((row) => {
        const r = [...row];
        while (r.length < validCols) r.push('0');
        return r.slice(0, validCols);
      });
      while (next.length < validRows) {
        next.push(Array(validCols).fill('0'));
      }
      return next.slice(0, validRows);
    });
  }, []);

  const updateMatrixCell = useCallback((row: number, col: number, value: string) => {
    setMatrixCells((prev) => {
      const next = prev.map((r, rIdx) => {
        if (rIdx !== row) return r;
        const newRow = [...r];
        newRow[col] = value;
        return newRow;
      });
      return next;
    });
  }, []);

  const applyMatrixPreset = useCallback((preset: 'identity' | 'zero' | 'symbolic' | 'diagonal') => {
    const newCells = generateMatrixPreset(preset, matrixRows, matrixCols);
    setMatrixCells(newCells);
    toast.success(`Applied ${preset} matrix preset`);
  }, [matrixRows, matrixCols]);

  const addMatrixRow = useCallback(() => {
    if (matrixRows >= 10) return;
    setMatrixRows(matrixRows + 1);
    setMatrixCells((prev) => [...prev, Array(matrixCols).fill('0')]);
  }, [matrixRows, matrixCols]);

  const removeMatrixRow = useCallback(() => {
    if (matrixRows <= 1) return;
    setMatrixRows(matrixRows - 1);
    setMatrixCells((prev) => prev.slice(0, -1));
  }, [matrixRows]);

  const addMatrixColumn = useCallback(() => {
    if (matrixCols >= 10) return;
    setMatrixCols(matrixCols + 1);
    setMatrixCells((prev) => prev.map((row) => [...row, '0']));
  }, [matrixCols]);

  const removeMatrixColumn = useCallback(() => {
    if (matrixCols <= 1) return;
    setMatrixCols(matrixCols - 1);
    setMatrixCells((prev) => prev.map((row) => row.slice(0, -1)));
  }, [matrixCols]);

  // ─── 6. Output Generation ───────────────────────────────────────────────────

  const generatedTableLatex = useMemo(() => {
    return generateLatexTable({
      rows: tableRows,
      cols: tableCols,
      headers: tableHeaders,
      data: tableData,
      alignments: tableAlignments,
      style: tableStyle,
      caption,
      label,
      placement,
      centering,
      hasHeaderRow,
    });
  }, [
    tableRows,
    tableCols,
    tableHeaders,
    tableData,
    tableAlignments,
    tableStyle,
    caption,
    label,
    placement,
    centering,
    hasHeaderRow,
  ]);

  const generatedMatrixLatex = useMemo(() => {
    return generateLatexMatrix({
      type: matrixType,
      rows: matrixRows,
      cols: matrixCols,
      cells: matrixCells,
      wrapper: matrixWrapper,
      equationLabel: matrixEquationLabel,
    });
  }, [
    matrixType,
    matrixRows,
    matrixCols,
    matrixCells,
    matrixWrapper,
    matrixEquationLabel,
  ]);

  const activeLatex = tab === 'table' ? generatedTableLatex : generatedMatrixLatex;

  const insertSnippet = useCallback(() => {
    onInsert(activeLatex);
    toast.success(tab === 'table' ? 'Table inserted into document' : 'Matrix inserted into document');
    onClose();
  }, [onInsert, activeLatex, tab, onClose]);

  const copySnippet = useCallback(() => {
    navigator.clipboard.writeText(activeLatex);
    toast.info('LaTeX code copied to clipboard');
  }, [activeLatex]);

  return {
    tab,
    setTab,

    // Table state & actions
    tableRows,
    tableCols,
    tableHeaders,
    tableData,
    tableAlignments,
    tableStyle,
    setTableStyle,
    caption,
    setCaption,
    label,
    setLabel,
    placement,
    setPlacement,
    centering,
    setCentering,
    hasHeaderRow,
    setHasHeaderRow,
    hoverRows,
    setHoverRows,
    hoverCols,
    setHoverCols,
    pastedText,
    setPastedText,
    setTableDimension,
    updateTableCell,
    updateTableHeader,
    toggleColumnAlignment,
    setAllAlignments,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    importPastedData,
    generatedTableLatex,

    // Matrix state & actions
    matrixType,
    setMatrixType,
    matrixRows,
    matrixCols,
    matrixCells,
    matrixWrapper,
    setMatrixWrapper,
    matrixEquationLabel,
    setMatrixEquationLabel,
    setMatrixDimension,
    updateMatrixCell,
    applyMatrixPreset,
    addMatrixRow,
    removeMatrixRow,
    addMatrixColumn,
    removeMatrixColumn,
    generatedMatrixLatex,

    // Combined actions
    activeLatex,
    insertSnippet,
    copySnippet,
  };
}
