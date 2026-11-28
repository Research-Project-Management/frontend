'use client';

/**
 * useTableEditor.ts
 *
 * State and actions hook for TableModal:
 * - Blank 3x3 grid defaults
 * - Row/column edits, column alignments, horizontal cell merges, border toggles
 * - TSV/CSV/LaTeX import parser and LaTeX output generation
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  type TableAlignment,
  type TableStyle,
  type TableCellMerge,
  type TableBorderConfig,
  generateLatexTable,
  parseLatexTabular,
  parseDelimitedTextToGrid,
} from '@/features/editor/domain/latex/table-matrix';

export type TableTab = 'table' | 'import' | 'ai';

export interface UseTableEditorOptions {
  onInsert: (latexCode: string) => void;
  onClose: () => void;
  initialTab?: TableTab | 'matrix';
  initialLatex?: string;
}

function normalizeTab(tab?: TableTab | 'matrix'): TableTab {
  if (tab === 'import' || tab === 'ai') return tab;
  return 'table';
}

export function useTableEditor({
  onInsert,
  onClose,
  initialTab = 'table',
  initialLatex = '',
}: UseTableEditorOptions) {
  const [tab, setTab] = useState<TableTab>(() => normalizeTab(initialTab));

  useEffect(() => {
    setTab(normalizeTab(initialTab));
  }, [initialTab]);

  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);
  const [headers, setHeaders] = useState<string[]>(['', '', '']);
  const [cells, setCells] = useState<string[][]>([
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ]);
  const [alignments, setAlignments] = useState<TableAlignment[]>(['c', 'c', 'c']);
  const [style, setStyle] = useState<TableStyle>('booktabs');
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
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [importText, setImportText] = useState<string>('');

  useEffect(() => {
    if (!initialLatex || !initialLatex.trim()) return;

    const parsed = parseLatexTabular(initialLatex);
    if (parsed) {
      setTab('table');
      setRows(parsed.rows);
      setCols(parsed.cols);
      setHeaders(parsed.headers);
      setCells(parsed.data);
      setAlignments(parsed.alignments);
      setStyle(parsed.style);
      setMerges(parsed.merges ?? []);
      setBorders(
        parsed.borders ??
          (parsed.style === 'bordered'
            ? { outer: true, innerHorizontal: true, innerVertical: true }
            : { outer: false, innerHorizontal: false, innerVertical: false }),
      );
      setCaption(parsed.caption ?? '');
      setLabel(parsed.label ?? '');
      if (parsed.placement) setPlacement(parsed.placement);
      setCentering(Boolean(parsed.centering));
      setHasHeader(Boolean(parsed.hasHeaderRow));
    }
  }, [initialLatex]);

  const setDimensions = useCallback((nextRows: number, nextCols: number) => {
    const validRows = Math.max(1, Math.min(50, nextRows));
    const validCols = Math.max(1, Math.min(20, nextCols));

    setRows(validRows);
    setCols(validCols);

    setHeaders((prev) => {
      const next = [...prev];
      while (next.length < validCols) next.push('');
      return next.slice(0, validCols);
    });

    setAlignments((prev) => {
      const next = [...prev];
      while (next.length < validCols) next.push('c');
      return next.slice(0, validCols);
    });

    setCells((prev) => {
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

  const updateCell = useCallback((row: number, col: number, value: string) => {
    setCells((prev) =>
      prev.map((r, rIdx) => {
        if (rIdx !== row) return r;
        const nextRow = [...r];
        nextRow[col] = value;
        return nextRow;
      }),
    );
  }, []);

  const updateHeader = useCallback((col: number, value: string) => {
    setHeaders((prev) => {
      const next = [...prev];
      next[col] = value;
      return next;
    });
  }, []);

  const cycleAlignment = useCallback((col: number) => {
    const nextAlignMap: Record<TableAlignment, TableAlignment> = {
      l: 'c',
      c: 'r',
      r: 'l',
    };
    setAlignments((prev) => {
      const next = [...prev];
      const current = next[col] || 'c';
      next[col] = nextAlignMap[current];
      return next;
    });
  }, []);

  const addRow = useCallback(
    (afterIndex?: number) => {
      const insertIdx = afterIndex !== undefined ? afterIndex + 1 : rows;
      setCells((prev) => {
        const newRow = Array(cols).fill('');
        const targetIdx = afterIndex !== undefined ? afterIndex + 1 : prev.length;
        const next = [...prev.slice(0, targetIdx), newRow, ...prev.slice(targetIdx)];
        setRows(next.length);
        return next;
      });
      setMerges((prev) =>
        prev.map((m) => (m.row >= insertIdx ? { ...m, row: m.row + 1 } : m)),
      );
    },
    [cols, rows],
  );

  const removeRow = useCallback((index: number) => {
    setCells((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setRows(next.length);
      return next;
    });
    setMerges((prev) =>
      prev
        .filter((m) => m.row !== index)
        .map((m) => (m.row > index ? { ...m, row: m.row - 1 } : m)),
    );
  }, []);

  const addColumn = useCallback(
    (afterIndex?: number) => {
      const targetIdx = afterIndex !== undefined ? afterIndex + 1 : cols;
      setCols(cols + 1);

      setHeaders((prev) => [...prev.slice(0, targetIdx), '', ...prev.slice(targetIdx)]);
      setAlignments((prev) => [...prev.slice(0, targetIdx), 'c', ...prev.slice(targetIdx)]);
      setCells((prev) =>
        prev.map((row) => [...row.slice(0, targetIdx), '', ...row.slice(targetIdx)]),
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
    },
    [cols],
  );

  const removeColumn = useCallback(
    (index: number) => {
      if (cols <= 1) return;
      setCols(cols - 1);
      setHeaders((prev) => prev.filter((_, i) => i !== index));
      setAlignments((prev) => prev.filter((_, i) => i !== index));
      setCells((prev) => prev.map((row) => row.filter((_, i) => i !== index)));
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
    },
    [cols],
  );

  const mergeCells = useCallback(
    (row: number, startCol: number, endCol: number) => {
      const cStart = Math.max(0, Math.min(startCol, endCol));
      const cEnd = Math.min(cols - 1, Math.max(startCol, endCol));
      const colSpan = cEnd - cStart + 1;
      if (colSpan < 2) return;

      if (row === -1) {
        setHeaders((prev) => {
          const next = [...prev];
          if (!next[cStart]?.trim()) {
            const nonEmpty = next.slice(cStart, cEnd + 1).find((v) => v?.trim());
            if (nonEmpty) next[cStart] = nonEmpty;
          }
          return next;
        });
      } else {
        setCells((prev) =>
          prev.map((r, rIdx) => {
            if (rIdx !== row) return r;
            const next = [...r];
            if (!next[cStart]?.trim()) {
              const nonEmpty = next.slice(cStart, cEnd + 1).find((v) => v?.trim());
              if (nonEmpty) next[cStart] = nonEmpty;
            }
            return next;
          }),
        );
      }

      setMerges((prev) => {
        const remaining = prev.filter(
          (m) => m.row !== row || m.col + m.colSpan - 1 < cStart || m.col > cEnd,
        );
        return [...remaining, { row, col: cStart, colSpan }];
      });
    },
    [cols],
  );

  const unmergeCell = useCallback((row: number, col: number) => {
    setMerges((prev) =>
      prev.filter((m) => !(m.row === row && col >= m.col && col < m.col + m.colSpan)),
    );
  }, []);

  const toggleBorder = useCallback((key: keyof TableBorderConfig) => {
    setBorders((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next.outer && next.innerHorizontal && next.innerVertical) {
        setStyle('bordered');
      } else {
        setStyle('minimal');
      }
      return next;
    });
  }, []);

  const applyBooktabs = useCallback(() => {
    setStyle('booktabs');
    setBorders({ outer: false, innerHorizontal: false, innerVertical: false });
  }, []);

  const importRaw = useCallback(
    (
      text: string,
      useHeaderSetting = true,
    ): { kind: 'latex' | 'delimited'; rows: number; cols: number } | null => {
      if (!text || !text.trim()) return null;
      const parsed = parseLatexTabular(text);
      if (parsed) {
        setRows(parsed.rows);
        setCols(parsed.cols);
        setHeaders(parsed.headers);
        setCells(parsed.data);
        setAlignments(parsed.alignments);
        setStyle(parsed.style);
        setMerges(parsed.merges ?? []);
        setBorders(
          parsed.borders ??
            (parsed.style === 'bordered'
              ? { outer: true, innerHorizontal: true, innerVertical: true }
              : { outer: false, innerHorizontal: false, innerVertical: false }),
        );
        setCaption(parsed.caption ?? '');
        setLabel(parsed.label ?? '');
        if (parsed.placement) setPlacement(parsed.placement);
        setCentering(Boolean(parsed.centering));
        setHasHeader(Boolean(parsed.hasHeaderRow));
        return { kind: 'latex', rows: parsed.rows, cols: parsed.cols };
      }

      const delimited = parseDelimitedTextToGrid(
        text,
        useHeaderSetting ? hasHeader : true,
      );
      if (delimited.cols > 0 && (delimited.rows > 0 || delimited.headers.length > 0)) {
        setCols(delimited.cols);
        setRows(Math.max(delimited.rows, 1));
        setHeaders(delimited.headers);
        setCells(delimited.data.length > 0 ? delimited.data : [Array(delimited.cols).fill('')]);
        setAlignments(Array(delimited.cols).fill('c'));
        setMerges([]);
        return { kind: 'delimited', rows: delimited.rows, cols: delimited.cols };
      }
      return null;
    },
    [hasHeader],
  );

  const importFromText = useCallback((): boolean => {
    if (!importText.trim()) return false;
    const imported = importRaw(importText, true);
    if (!imported) {
      toast.error('Could not parse table data', { id: 'import-table' });
      return false;
    }
    if (imported.kind === 'latex') {
      toast.success('Imported LaTeX table into visual editor', { id: 'import-table' });
    } else {
      toast.success(`Imported ${imported.rows} rows and ${imported.cols} columns`, {
        id: 'import-table',
      });
    }
    setImportText('');
    return true;
  }, [importText, importRaw]);

  const latex = useMemo(
    () =>
      generateLatexTable({
        rows,
        cols,
        headers,
        data: cells,
        alignments,
        style,
        caption,
        label,
        placement,
        centering,
        hasHeaderRow: hasHeader,
        merges,
        borders,
      }),
    [
      rows,
      cols,
      headers,
      cells,
      alignments,
      style,
      caption,
      label,
      placement,
      centering,
      hasHeader,
      merges,
      borders,
    ],
  );

  const insertTable = useCallback(() => {
    onInsert(latex);
    toast.success('Table inserted into document');
    onClose();
  }, [onInsert, latex, onClose]);

  return {
    tab,
    setTab,
    rows,
    cols,
    headers,
    cells,
    alignments,
    style,
    merges,
    borders,
    caption,
    setCaption,
    label,
    setLabel,
    centering,
    setCentering,
    hasHeader,
    setHasHeader,
    importText,
    setImportText,
    setDimensions,
    updateCell,
    updateHeader,
    cycleAlignment,
    addRow,
    removeRow,
    addColumn,
    removeColumn,
    mergeCells,
    unmergeCell,
    toggleBorder,
    applyBooktabs,
    importFromText,
    importRaw,
    insertTable,
  };
}
