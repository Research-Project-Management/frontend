/**
 * table-matrix.ts
 *
 * Core Pure Domain Utilities for LaTeX Table & Matrix Generation and Reverse-Parsing (Domain Layer).
 * Supports:
 * - Table code generation: Booktabs (academic standard), Bordered (full grid), Minimal
 * - Robust Table LaTeX reverse-parser (reconstructing visual grid from LaTeX source)
 * - CSV / TSV / Excel table import parser
 * - Matrix code generation: pmatrix, bmatrix, vmatrix, Bmatrix, Vmatrix, matrix
 * - Matrix presets: Identity (I), Zero (0), Symbolic (a_{ij}), Diagonal
 * - Matrix LaTeX reverse-parser
 */

export type TableAlignment = 'l' | 'c' | 'r';
export type TableStyle = 'booktabs' | 'bordered' | 'minimal';

export interface TableGrid {
  rows: number;
  cols: number;
  headers: string[];
  data: string[][];
  alignments: TableAlignment[];
  style: TableStyle;
  caption?: string;
  label?: string;
  placement?: string;
  centering?: boolean;
  hasHeaderRow?: boolean;
}

export type MatrixType =
  | 'pmatrix' // ( )
  | 'bmatrix' // [ ]
  | 'vmatrix' // | |
  | 'Bmatrix' // { }
  | 'Vmatrix' // || ||
  | 'matrix';  // plain

export type MatrixWrapper = 'inline' | 'display' | 'equation' | 'raw';

export interface MatrixGrid {
  type: MatrixType;
  rows: number;
  cols: number;
  cells: string[][];
  wrapper: MatrixWrapper;
  equationLabel?: string;
}

/**
 * Escapes unescaped LaTeX special characters in table text, preserving math segments.
 */
export function sanitizeTableCell(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
    return trimmed;
  }
  return trimmed
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([%$#&_{}])/g, (match, char, offset, str) => {
      // Don't escape if preceded by backslash
      if (offset > 0 && str[offset - 1] === '\\') return match;
      return `\\${char}`;
    });
}

/**
 * Unescapes LaTeX characters from parsed cell text back to plain text.
 */
export function unescapeTableCell(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\textbackslash\{\}/g, '\\')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .trim();
}

/**
 * Generates clean, production-ready LaTeX table code.
 */
export function generateLatexTable(grid: TableGrid): string {
  const {
    rows,
    cols,
    headers,
    data,
    alignments,
    style = 'booktabs',
    caption = '',
    label = '',
    placement = 'htbp',
    centering = true,
    hasHeaderRow = true,
  } = grid;

  // Build column alignment specifier
  let colSpec = '';
  if (style === 'bordered') {
    colSpec = `|${Array.from({ length: cols }, (_, i) => alignments[i] || 'c').join('|')}|`;
  } else {
    colSpec = Array.from({ length: cols }, (_, i) => alignments[i] || 'c').join('');
  }

  let body = '';

  // 1. Header row
  if (hasHeaderRow && headers && headers.length > 0) {
    const formattedHeaders = Array.from({ length: cols }, (_, c) =>
      sanitizeTableCell(headers[c] || `Header ${c + 1}`)
    );
    body += `    ${formattedHeaders.join(' & ')} \\\\\n`;

    if (style === 'booktabs') {
      body += `    \\midrule\n`;
    } else if (style === 'bordered') {
      body += `    \\hline\n`;
    }
  }

  // 2. Data rows
  const actualRows = Math.max(rows, data.length);
  for (let r = 0; r < actualRows; r++) {
    const rowData = data[r] || [];
    const formattedCells = Array.from({ length: cols }, (_, c) =>
      sanitizeTableCell(rowData[c] || '')
    );

    body += `    ${formattedCells.join(' & ')} \\\\\n`;

    if (style === 'bordered' && r < actualRows - 1) {
      body += `    \\hline\n`;
    }
  }

  // Wrap in environment
  let result = `\\begin{table}[${placement}]\n`;
  if (centering) {
    result += `  \\centering\n`;
  }
  if (caption) {
    result += `  \\caption{${caption}}\n`;
  }
  if (label) {
    result += `  \\label{${label}}\n`;
  }

  result += `  \\begin{tabular}{${colSpec}}\n`;

  if (style === 'booktabs') {
    result += `    \\toprule\n`;
  } else if (style === 'bordered') {
    result += `    \\hline\n`;
  }

  result += body;

  if (style === 'booktabs') {
    result += `    \\bottomrule\n`;
  } else if (style === 'bordered') {
    result += `    \\hline\n`;
  }

  result += `  \\end{tabular}\n`;
  result += `\\end{table}\n`;

  return result;
}

/**
 * Parses LaTeX table or tabular environment into a structured TableGrid.
 */
export function parseLatexTabular(latex: string): TableGrid | null {
  if (!latex || typeof latex !== 'string') return null;

  const tabularMatch = latex.match(
    /\\begin\{tabular\*?\}(?:\[[^\]]*\])?\{([^}]*)\}([\s\S]*?)\\end\{tabular\*?\}/
  );

  if (!tabularMatch) return null;

  const rawAlignSpec = tabularMatch[1].trim();
  const rawBody = tabularMatch[2];

  // Extract caption & label if wrapped in \begin{table}
  const captionMatch = latex.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
  const caption = captionMatch ? captionMatch[1] : '';

  const labelMatch = latex.match(/\\label\{([^}]+)\}/);
  const label = labelMatch ? labelMatch[1] : '';

  const placementMatch = latex.match(/\\begin\{table\*?\}(?:\[([^\]]*)\])/);
  const placement = placementMatch ? placementMatch[1] : 'htbp';

  const centering = /\\centering/.test(latex);

  // Determine style and column alignments
  const isBordered = rawAlignSpec.includes('|');
  const hasBooktabs = /\\(toprule|midrule|bottomrule)/.test(rawBody);
  const style: TableStyle = hasBooktabs
    ? 'booktabs'
    : isBordered
    ? 'bordered'
    : 'minimal';

  // Extract alignments: strip |, @{}, p{...}
  const cleanAligns = rawAlignSpec.replace(/\|/g, '').replace(/@\{[^}]*\}/g, '');
  const alignments: TableAlignment[] = [];
  for (const char of cleanAligns) {
    if (char === 'l' || char === 'c' || char === 'r') {
      alignments.push(char);
    }
  }

  // Split rows by \\ (ignoring optional spacing like \\[...])
  const rawRows = rawBody.split(/\\\\(?:\s*\[[^\]]*\])?/);

  const parsedRows: string[][] = [];
  let detectedHeader = false;

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i].trim();
    if (!rawRow) continue;

    // Check if this row preceded a \midrule
    const cleanRow = rawRow
      .replace(/\\toprule/g, '')
      .replace(/\\midrule/g, '')
      .replace(/\\bottomrule/g, '')
      .replace(/\\hline/g, '')
      .replace(/\\cline\{[^}]*\}/g, '')
      .trim();

    if (!cleanRow) continue;

    // Split cells by unescaped &
    const cells = cleanRow.split(/(?<!\\)&/).map((c) => unescapeTableCell(c));
    parsedRows.push(cells);

    // If the raw row had midrule or hline after first line, it has a header
    if (parsedRows.length === 1 && (/\\midrule/.test(rawRow) || /\\hline/.test(rawRow))) {
      detectedHeader = true;
    }
  }

  if (parsedRows.length === 0) return null;

  const cols = Math.max(
    alignments.length,
    ...parsedRows.map((r) => r.length),
    1
  );

  // Fill in missing alignments if needed
  while (alignments.length < cols) {
    alignments.push('c');
  }

  let headers: string[] = [];
  let data: string[][] = [];

  if (detectedHeader || (parsedRows.length > 1 && hasBooktabs)) {
    headers = Array.from({ length: cols }, (_, c) => parsedRows[0][c] || '');
    data = parsedRows.slice(1).map((row) =>
      Array.from({ length: cols }, (_, c) => row[c] || '')
    );
  } else {
    headers = Array.from({ length: cols }, (_, c) => `Col ${c + 1}`);
    data = parsedRows.map((row) =>
      Array.from({ length: cols }, (_, c) => row[c] || '')
    );
  }

  return {
    rows: data.length,
    cols,
    headers,
    data,
    alignments,
    style,
    caption,
    label,
    placement,
    centering,
    hasHeaderRow: Boolean(detectedHeader || (parsedRows.length > 1 && hasBooktabs)),
  };
}

/**
 * Parses TSV (Excel/Google Sheets) or CSV text into headers and data grid.
 */
export function parseDelimitedTextToGrid(
  text: string,
  hasHeaderRow: boolean = true
): { headers: string[]; data: string[][]; cols: number; rows: number } {
  if (!text || !text.trim()) {
    return { headers: [], data: [], cols: 0, rows: 0 };
  }

  const sampleLine = text.split(/\r?\n/)[0] || '';
  let delimiter = '\t';
  if (!sampleLine.includes('\t')) {
    if (sampleLine.includes(',')) delimiter = ',';
    else if (sampleLine.includes(';')) delimiter = ';';
  }

  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = lines.map((line) => {
    if (delimiter === ',') {
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const entries: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] ?? '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        entries.push(val.trim());
        if (match.index + match[0].length >= line.length) break;
      }
      return entries;
    }
    return line.split(delimiter).map((c) => c.trim());
  });

  const cols = Math.max(...rows.map((r) => r.length), 1);

  // Normalize row lengths
  const normalized = rows.map((r) => {
    const row = [...r];
    while (row.length < cols) row.push('');
    return row;
  });

  let headers: string[] = [];
  let data: string[][] = [];

  if (hasHeaderRow && normalized.length > 0) {
    headers = normalized[0];
    data = normalized.slice(1);
  } else {
    headers = Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
    data = normalized;
  }

  return {
    headers,
    data,
    cols,
    rows: data.length,
  };
}

/**
 * Generates matrix presets (Identity, Zero, Symbolic, Diagonal).
 */
export function generateMatrixPreset(
  preset: 'identity' | 'zero' | 'symbolic' | 'diagonal',
  rows: number,
  cols: number
): string[][] {
  const result: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      if (preset === 'identity') {
        row.push(r === c ? '1' : '0');
      } else if (preset === 'zero') {
        row.push('0');
      } else if (preset === 'symbolic') {
        row.push(`a_{${r + 1}${c + 1}}`);
      } else if (preset === 'diagonal') {
        row.push(r === c ? `d_{${r + 1}}` : '0');
      }
    }
    result.push(row);
  }
  return result;
}

/**
 * Generates clean LaTeX matrix code.
 */
export function generateLatexMatrix(grid: MatrixGrid): string {
  const {
    type = 'pmatrix',
    rows,
    cols,
    cells,
    wrapper = 'display',
    equationLabel = '',
  } = grid;

  const actualRows = Math.max(rows, cells.length);
  const actualCols = Math.max(cols, ...cells.map((r) => r.length), 1);

  const rowStrings: string[] = [];
  for (let r = 0; r < actualRows; r++) {
    const row = cells[r] || [];
    const formattedCells = Array.from({ length: actualCols }, (_, c) => {
      const val = row[c] ?? '';
      return val.trim() || '0';
    });
    rowStrings.push(`  ${formattedCells.join(' & ')}`);
  }

  const inner = `\\begin{${type}}\n${rowStrings.join(' \\\\\n')}\n\\end{${type}}`;

  switch (wrapper) {
    case 'inline':
      return `$${inner}$`;
    case 'display':
      return `\\[\n${inner}\n\\]`;
    case 'equation':
      return `\\begin{equation}\n${inner}\n${equationLabel ? `  \\label{${equationLabel}}\n` : ''}\\end{equation}`;
    case 'raw':
    default:
      return inner;
  }
}

/**
 * Parses LaTeX matrix back into a structured MatrixGrid.
 */
export function parseLatexMatrix(latex: string): MatrixGrid | null {
  if (!latex || typeof latex !== 'string') return null;

  const match = latex.match(
    /\\begin\{(pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/
  );

  if (!match) return null;

  const type = match[1] as MatrixType;
  const rawBody = match[2];

  // Determine wrapper
  let wrapper: MatrixWrapper = 'raw';
  let equationLabel = '';

  if (/\\begin\{equation\}/.test(latex)) {
    wrapper = 'equation';
    const labelMatch = latex.match(/\\label\{([^}]+)\}/);
    if (labelMatch) equationLabel = labelMatch[1];
  } else if (/^\\\[[\s\S]*\\\]$/.test(latex.trim())) {
    wrapper = 'display';
  } else if (/^\$[^$]+\$$/.test(latex.trim())) {
    wrapper = 'inline';
  }

  const rawRows = rawBody.split(/\\\\(?:\s*\[[^\]]*\])?/);
  const parsedCells: string[][] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i].trim();
    if (!rawRow) continue;
    const row = rawRow.split(/(?<!\\)&/).map((c) => c.trim());
    parsedCells.push(row);
  }

  if (parsedCells.length === 0) return null;

  const rows = parsedCells.length;
  const cols = Math.max(...parsedCells.map((r) => r.length), 1);

  // Normalize dimensions
  const normalizedCells = parsedCells.map((r) => {
    const row = [...r];
    while (row.length < cols) row.push('0');
    return row;
  });

  return {
    type,
    rows,
    cols,
    cells: normalizedCells,
    wrapper,
    equationLabel,
  };
}
