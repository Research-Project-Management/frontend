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
  type TableCellMerge,
  type TableBorderConfig,
  type MatrixType,
  type MatrixWrapper,
  generateLatexTable,
  parseLatexTabular,
  parseDelimitedTextToGrid,
  generateLatexMatrix,
  generateMatrixPreset,
} from '@/features/editor/domain/latex/table-matrix';

export type TableWizardTab = 'table' | 'import' | 'ai' | 'matrix';

export interface UseTableMatrixWizardOptions {
  onInsert: (latexCode: string) => void;
  onClose: () => void;
  initialTab?: TableWizardTab;
  initialLatex?: string;
}

function normalizeInitialTab(tab?: TableWizardTab): TableWizardTab {
  if (tab === 'import' || tab === 'ai' || tab === 'matrix') return tab;
  return 'table';
}

export function useTableMatrixWizard({
  onInsert,
  onClose,
  initialTab = 'table',
  initialLatex = '',
}: UseTableMatrixWizardOptions) {
  const [tab, setTab] = useState<TableWizardTab>(() => normalizeInitialTab(initialTab));

  useEffect(() => {
    setTab(normalizeInitialTab(initialTab));
  }, [initialTab]);

  // ─── 1. Table Grid State (clean blank 3x3 Overleaf default) ─────────────────
  const [tableRows, setTableRows] = useState<number>(3);
  const [tableCols, setTableCols] = useState<number>(3);
  const [tableHeaders, setTableHeaders] = useState<string[]>(['', '', '']);
  const [tableData, setTableData] = useState<string[][]>([
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ]);
  const [tableAlignments, setTableAlignments] = useState<TableAlignment[]>([
    'c',
    'c',
    'c',
  ]);
  const [tableStyle, setTableStyle] = useState<TableStyle>('booktabs');
  const [merges, setMerges] = useState<TableCellMerge[]>([]);
  const [borders, setBorders] = useState<TableBorderConfig>({
    outer: false,
    innerHorizontal: false,
    innerVertical: false,
  });
  const [caption, setCaption] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [placement, setPlacement] = useState<string>('htbp');
  const [centering, setCentering] = useState<boolean>(true);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);

  // Table paste / import state
  const [pastedText, setPastedText] = useState<string>('');

  // ─── 2. Matrix Grid State (kept for hook compatibility) ────────────────────
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

    const parsedTable = parseLatexTabular(initialLatex);
    if (parsedTable) {
      setTab('table');
      setTableRows(parsedTable.rows);
      setTableCols(parsedTable.cols);
      setTableHeaders(parsedTable.headers);
      setTableData(parsedTable.data);
      setTableAlignments(parsedTable.alignments);
      setTableStyle(parsedTable.style);
      setMerges(parsedTable.merges ?? []);
      setBorders(
        parsedTable.borders ??
          (parsedTable.style === 'bordered'
            ? { outer: true, innerHorizontal: true, innerVertical: true }
            : { outer: false, innerHorizontal: false, innerVertical: false }),
      );
      setCaption(parsedTable.caption ?? '');
      setLabel(parsedTable.label ?? '');
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
      while (next.length < validCols) next.push('');
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

    // Clip merges to new bounds
    setMerges((prev) =>
      prev
        .filter((m) => m.row < validRows && m.col < validCols)
        .map((m) => ({
          ...m,
          colSpan: Math.min(m.colSpan, validCols - m.col),
        }))
        .filter((m) => m.colSpan >= 2),
    );
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
    const insertIdx = afterIndex !== undefined ? afterIndex + 1 : tableRows;
    setTableData((prev) => {
      const newRow = Array(tableCols).fill('');
      const targetIdx = afterIndex !== undefined ? afterIndex + 1 : prev.length;
      const next = [...prev.slice(0, targetIdx), newRow, ...prev.slice(targetIdx)];
      setTableRows(next.length);
      return next;
    });
    setMerges((prev) =>
      prev.map((m) => (m.row >= insertIdx ? { ...m, row: m.row + 1 } : m)),
    );
  }, [tableCols, tableRows]);

  const removeTableRow = useCallback((index: number) => {
    setTableData((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setTableRows(next.length);
      return next;
    });
    setMerges((prev) =>
      prev
        .filter((m) => m.row !== index)
        .map((m) => (m.row > index ? { ...m, row: m.row - 1 } : m)),
    );
  }, []);

  const addTableColumn = useCallback((afterIndex?: number) => {
    const targetIdx = afterIndex !== undefined ? afterIndex + 1 : tableCols;
    const newColCount = tableCols + 1;
    setTableCols(newColCount);

    setTableHeaders((prev) => [
      ...prev.slice(0, targetIdx),
      '',
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

    setMerges((prev) =>
      prev.map((m) => {
        if (targetIdx <= m.col) return { ...m, col: m.col + 1 };
        if (targetIdx > m.col && targetIdx < m.col + m.colSpan) {
          return { ...m, colSpan: m.colSpan + 1 };
        }
        return m;
      }),
    );
  }, [tableCols]);

  const removeTableColumn = useCallback((index: number) => {
    if (tableCols <= 1) return;
    const newColCount = tableCols - 1;
    setTableCols(newColCount);
    setTableHeaders((prev) => prev.filter((_, i) => i !== index));
    setTableAlignments((prev) => prev.filter((_, i) => i !== index));
    setTableData((prev) => prev.map((row) => row.filter((_, i) => i !== index)));
    setMerges((prev) =>
      prev
        .map((m) => {
          if (index < m.col) return { ...m, col: m.col - 1 };
          if (index >= m.col && index < m.col + m.colSpan) {
            return { ...m, colSpan: m.colSpan - 1 };
          }
          return m;
        })
        .filter((m) => m.colSpan >= 2),
    );
  }, [tableCols]);

  const mergeCells = useCallback((row: number, startCol: number, endCol: number) => {
    const cStart = Math.max(0, Math.min(startCol, endCol));
    const cEnd = Math.min(tableCols - 1, Math.max(startCol, endCol));
    const colSpan = cEnd - cStart + 1;
    if (colSpan < 2) return;

    if (row === -1) {
      setTableHeaders((prev) => {
        const next = [...prev];
        if (!next[cStart]?.trim()) {
          const firstNonEmpty = next.slice(cStart, cEnd + 1).find((v) => v?.trim());
          if (firstNonEmpty) next[cStart] = firstNonEmpty;
        }
        return next;
      });
    } else {
      setTableData((prev) =>
        prev.map((r, rIdx) => {
          if (rIdx !== row) return r;
          const next = [...r];
          if (!next[cStart]?.trim()) {
            const firstNonEmpty = next.slice(cStart, cEnd + 1).find((v) => v?.trim());
            if (firstNonEmpty) next[cStart] = firstNonEmpty;
          }
          return next;
        }),
      );
    }

    setMerges((prev) => {
      const nonOverlapping = prev.filter(
        (m) => m.row !== row || m.col + m.colSpan - 1 < cStart || m.col > cEnd,
      );
      return [...nonOverlapping, { row, col: cStart, colSpan }];
    });
  }, [tableCols]);

  const unmergeCell = useCallback((row: number, col: number) => {
    setMerges((prev) =>
      prev.filter((m) => !(m.row === row && col >= m.col && col < m.col + m.colSpan)),
    );
  }, []);

  const toggleBorder = useCallback((key: keyof TableBorderConfig) => {
    setBorders((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next.outer || next.innerHorizontal || next.innerVertical) {
        setTableStyle(
          next.outer && next.innerHorizontal && next.innerVertical ? 'bordered' : 'minimal',
        );
      } else {
        setTableStyle('minimal');
      }
      return next;
    });
  }, []);

  const applyBooktabsPreset = useCallback(() => {
    setTableStyle('booktabs');
    setBorders({ outer: false, innerHorizontal: false, innerVertical: false });
  }, []);

  const importRawText = useCallback(
    (text: string, useHeaderSetting = true): { kind: 'latex' | 'delimited'; rows: number; cols: number } | null => {
      if (!text || !text.trim()) return null;
      const parsedLatex = parseLatexTabular(text);
      if (parsedLatex) {
        setTableRows(parsedLatex.rows);
        setTableCols(parsedLatex.cols);
        setTableHeaders(parsedLatex.headers);
        setTableData(parsedLatex.data);
        setTableAlignments(parsedLatex.alignments);
        setTableStyle(parsedLatex.style);
        setMerges(parsedLatex.merges ?? []);
        setBorders(
          parsedLatex.borders ??
            (parsedLatex.style === 'bordered'
              ? { outer: true, innerHorizontal: true, innerVertical: true }
              : { outer: false, innerHorizontal: false, innerVertical: false }),
        );
        setCaption(parsedLatex.caption ?? '');
        setLabel(parsedLatex.label ?? '');
        if (parsedLatex.placement) setPlacement(parsedLatex.placement);
        setCentering(Boolean(parsedLatex.centering));
        setHasHeaderRow(Boolean(parsedLatex.hasHeaderRow));
        return { kind: 'latex', rows: parsedLatex.rows, cols: parsedLatex.cols };
      }

      const { headers, data, cols, rows } = parseDelimitedTextToGrid(
        text,
        useHeaderSetting ? hasHeaderRow : true,
      );
      if (cols > 0 && (rows > 0 || headers.length > 0)) {
        setTableCols(cols);
        setTableRows(Math.max(rows, 1));
        setTableHeaders(headers);
        setTableData(data.length > 0 ? data : [Array(cols).fill('')]);
        setTableAlignments(Array(cols).fill('c'));
        setMerges([]);
        return { kind: 'delimited', rows, cols };
      }
      return null;
    },
    [hasHeaderRow],
  );

  const importPastedData = useCallback((): boolean => {
    if (!pastedText.trim()) return false;
    const imported = importRawText(pastedText, true);
    if (!imported) {
      toast.error('Could not parse table data', { id: 'import-table' });
      return false;
    }
    if (imported.kind === 'latex') {
      toast.success('Imported LaTeX table into visual editor', { id: 'import-table' });
    } else {
      toast.success(`Imported ${imported.rows} rows and ${imported.cols} columns`, { id: 'import-table' });
    }
    setPastedText('');
    return true;
  }, [pastedText, importRawText]);

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
      merges,
      borders,
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
    merges,
    borders,
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

  const activeLatex = generatedTableLatex;

  const insertSnippet = useCallback(() => {
    onInsert(generatedTableLatex);
    toast.success('Table inserted into document');
    onClose();
  }, [onInsert, generatedTableLatex, onClose]);

  const copySnippet = useCallback(() => {
    navigator.clipboard.writeText(generatedTableLatex);
    toast.info('LaTeX code copied to clipboard', { id: 'copy-latex-snippet' });
  }, [generatedTableLatex]);

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
    merges,
    borders,
    setBorders,
    mergeCells,
    unmergeCell,
    toggleBorder,
    applyBooktabsPreset,
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
    importRawText,
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
