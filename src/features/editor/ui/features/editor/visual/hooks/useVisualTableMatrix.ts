'use client';

import { useState, useCallback, useEffect } from 'react';

export interface ActiveTableState {
  table: HTMLTableElement;
  cell: HTMLTableCellElement;
  rowIndex: number;
  colIndex: number;
  totalRows: number;
  totalCols: number;
  caption: string;
  label: string;
  columnAlignment: 'left' | 'center' | 'right';
  position: { top: number; left: number };
}

interface UseVisualTableMatrixOptions {
  syncHtmlToLatex: () => void;
}

export function useVisualTableMatrix({ syncHtmlToLatex }: UseVisualTableMatrixOptions) {
  const [activeTable, setActiveTable] = useState<ActiveTableState | null>(null);

  const handleTableCellClick = useCallback(
    (cell: HTMLTableCellElement, table: HTMLTableElement) => {
      const row = cell.closest('tr') as HTMLTableRowElement | null;
      const rowIndex = row ? Array.from(table.rows).indexOf(row) : 0;
      const colIndex = row ? Array.from(row.cells).indexOf(cell) : 0;
      const totalRows = table.rows.length;
      const totalCols = table.rows[0]?.cells.length || 0;

      const rawCap = table.getAttribute('data-caption') || '';
      const cap = rawCap ? decodeURIComponent(rawCap) : '';

      const rawLab = table.getAttribute('data-label') || '';
      const lab = rawLab ? decodeURIComponent(rawLab) : '';

      const rawAlg = table.getAttribute('data-align') || '';
      const algSpec = rawAlg ? decodeURIComponent(rawAlg) : '';
      const algTokens = algSpec.trim() ? algSpec.trim().split(/\s+/) : [];
      const colChar = algTokens[colIndex] || 'c';
      const colAlign: 'left' | 'center' | 'right' =
        colChar === 'l' ? 'left' : colChar === 'r' ? 'right' : 'center';

      const tableRect = table.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      let top = tableRect.top - 48;
      if (top < 60) {
        top = Math.max(60, cellRect.top - 48);
      }
      const left = Math.max(20, Math.min(window.innerWidth - 450, tableRect.left));

      setActiveTable({
        table,
        cell,
        rowIndex,
        colIndex,
        totalRows,
        totalCols,
        caption: cap,
        label: lab,
        columnAlignment: colAlign,
        position: { top, left },
      });
    },
    []
  );

  const updateTableAlignmentSpec = useCallback(
    (table: HTMLTableElement, mutator: (tokens: string[]) => void) => {
      const rawAlign = table.getAttribute('data-align') || '';
      const alignSpec = rawAlign ? decodeURIComponent(rawAlign) : '';
      let tokens = alignSpec.trim() ? alignSpec.trim().split(/\s+/) : [];

      mutator(tokens);

      const maxCols = table.rows[0]?.cells.length || 0;
      while (tokens.length < maxCols) tokens.push('c');
      if (tokens.length > maxCols) tokens = tokens.slice(0, maxCols);

      table.setAttribute('data-align', encodeURIComponent(tokens.join(' ')));
    },
    []
  );

  const handleAddRowAbove = useCallback(() => {
    if (!activeTable) return;
    const { table, rowIndex } = activeTable;
    const totalCols = table.rows[0]?.cells.length || 2;

    const targetRow = table.rows[rowIndex];
    const parent = targetRow?.parentElement || table;
    const newRow = document.createElement('tr');
    for (let c = 0; c < totalCols; c++) {
      const td = document.createElement('td');
      td.className = 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      td.appendChild(p);
      newRow.appendChild(td);
    }

    if (targetRow) {
      parent.insertBefore(newRow, targetRow);
    } else {
      parent.appendChild(newRow);
    }

    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalRows: table.rows.length,
            rowIndex: rowIndex + 1,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  const handleAddRowBelow = useCallback(() => {
    if (!activeTable) return;
    const { table, rowIndex } = activeTable;
    const totalCols = table.rows[0]?.cells.length || 2;

    const targetRow = table.rows[rowIndex];
    const parent = targetRow?.parentElement || table;
    const newRow = document.createElement('tr');
    for (let c = 0; c < totalCols; c++) {
      const td = document.createElement('td');
      td.className = 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      td.appendChild(p);
      newRow.appendChild(td);
    }

    if (targetRow && targetRow.parentElement?.tagName.toLowerCase() === 'thead') {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        tbody.insertBefore(newRow, tbody.firstChild);
      } else {
        table.appendChild(newRow);
      }
    } else if (targetRow && targetRow.nextElementSibling) {
      parent.insertBefore(newRow, targetRow.nextElementSibling);
    } else {
      parent.appendChild(newRow);
    }

    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalRows: table.rows.length,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  const handleDeleteRow = useCallback(() => {
    if (!activeTable) return;
    const { table, rowIndex } = activeTable;

    if (table.rows.length <= 1) {
      table.remove();
      setActiveTable(null);
      syncHtmlToLatex();
      return;
    }

    const targetRow = table.rows[rowIndex];
    if (targetRow) {
      targetRow.remove();
    }

    const nextRowIndex = Math.min(rowIndex, table.rows.length - 1);
    const nextRow = table.rows[nextRowIndex];
    const nextCell = nextRow ? nextRow.cells[activeTable.colIndex] || nextRow.cells[0] : null;

    if (nextCell) {
      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              cell: nextCell,
              rowIndex: nextRowIndex,
              totalRows: table.rows.length,
            }
          : null
      );
    } else {
      setActiveTable(null);
    }

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  const handleAddColumnLeft = useCallback(() => {
    if (!activeTable) return;
    const { table, colIndex } = activeTable;

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isHead =
        row.parentElement?.tagName.toLowerCase() === 'thead' || row.querySelector('th') !== null;
      const cellEl = document.createElement(isHead ? 'th' : 'td');
      cellEl.className = isHead
        ? 'p-2 border border-border bg-muted/40 font-semibold'
        : 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = isHead ? `Header ${colIndex + 1}` : '<br>';
      cellEl.appendChild(p);

      if (colIndex < row.cells.length) {
        row.insertBefore(cellEl, row.cells[colIndex]);
      } else {
        row.appendChild(cellEl);
      }
    }

    updateTableAlignmentSpec(table, (tokens) => {
      tokens.splice(colIndex, 0, 'c');
    });

    const totalCols = table.rows[0]?.cells.length || 0;
    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalCols,
            colIndex: colIndex + 1,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]);

  const handleAddColumnRight = useCallback(() => {
    if (!activeTable) return;
    const { table, colIndex } = activeTable;
    const insertIndex = colIndex + 1;

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isHead =
        row.parentElement?.tagName.toLowerCase() === 'thead' || row.querySelector('th') !== null;
      const cellEl = document.createElement(isHead ? 'th' : 'td');
      cellEl.className = isHead
        ? 'p-2 border border-border bg-muted/40 font-semibold'
        : 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = isHead ? `Header ${insertIndex + 1}` : '<br>';
      cellEl.appendChild(p);

      if (insertIndex < row.cells.length) {
        row.insertBefore(cellEl, row.cells[insertIndex]);
      } else {
        row.appendChild(cellEl);
      }
    }

    updateTableAlignmentSpec(table, (tokens) => {
      tokens.splice(insertIndex, 0, 'c');
    });

    const totalCols = table.rows[0]?.cells.length || 0;
    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalCols,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]);

  const handleDeleteColumn = useCallback(() => {
    if (!activeTable) return;
    const { table, colIndex } = activeTable;
    const totalCols = table.rows[0]?.cells.length || 0;

    if (totalCols <= 1) {
      table.remove();
      setActiveTable(null);
      syncHtmlToLatex();
      return;
    }

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (row.cells[colIndex]) {
        row.cells[colIndex].remove();
      }
    }

    updateTableAlignmentSpec(table, (tokens) => {
      if (colIndex < tokens.length) {
        tokens.splice(colIndex, 1);
      }
    });

    const newTotalCols = table.rows[0]?.cells.length || 0;
    const nextColIndex = Math.min(colIndex, newTotalCols - 1);
    const nextRow = table.rows[activeTable.rowIndex] || table.rows[0];
    const nextCell = nextRow ? nextRow.cells[nextColIndex] : null;

    if (nextCell) {
      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              cell: nextCell,
              colIndex: nextColIndex,
              totalCols: newTotalCols,
            }
          : null
      );
    } else {
      setActiveTable(null);
    }

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]);

  const handleAlignColumn = useCallback(
    (align: 'left' | 'center' | 'right') => {
      if (!activeTable) return;
      const { table, colIndex } = activeTable;
      const char = align === 'left' ? 'l' : align === 'right' ? 'r' : 'c';

      updateTableAlignmentSpec(table, (tokens) => {
        tokens[colIndex] = char;
      });

      const alignClass =
        align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
      for (let r = 0; r < table.rows.length; r++) {
        const c = table.rows[r].cells[colIndex];
        if (c) {
          c.classList.remove('text-left', 'text-center', 'text-right');
          c.classList.add(alignClass);
        }
      }

      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              columnAlignment: align,
            }
          : null
      );

      syncHtmlToLatex();
    },
    [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]
  );

  const handleUpdateMetadata = useCallback(
    (caption: string, label: string) => {
      if (!activeTable) return;
      const { table } = activeTable;

      if (caption) {
        table.setAttribute('data-caption', encodeURIComponent(caption));
      } else {
        table.removeAttribute('data-caption');
      }

      if (label) {
        table.setAttribute('data-label', encodeURIComponent(label));
      } else {
        table.removeAttribute('data-label');
      }

      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              caption,
              label,
            }
          : null
      );

      syncHtmlToLatex();
    },
    [activeTable, syncHtmlToLatex]
  );

  const handleDeleteTable = useCallback(() => {
    if (!activeTable) return;
    activeTable.table.remove();
    setActiveTable(null);
    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        activeTable &&
        !target.closest('table') &&
        !target.closest('[role="toolbar"]')
      ) {
        setActiveTable(null);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [activeTable]);

  return {
    activeTable,
    setActiveTable,
    handleTableCellClick,
    handleAddRowAbove,
    handleAddRowBelow,
    handleDeleteRow,
    handleAddColumnLeft,
    handleAddColumnRight,
    handleDeleteColumn,
    handleAlignColumn,
    handleUpdateMetadata,
    handleDeleteTable,
  };
}
