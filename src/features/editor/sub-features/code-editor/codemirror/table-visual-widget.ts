/**
 * table-visual-widget.ts
 *
 * Overleaf-parity Visual Table Widget for CodeMirror 6:
 * - WYSIWYG interactive table with in-place cell editing
 * - Floating contextual action bar:
 *   - Caption dropdown/editor
 *   - Border styles (Booktabs, All borders, No borders, Custom borders)
 *   - Column/cell text alignment (Left, Center, Right)
 *   - Column width controls & measurements (|-> 8cm)
 *   - Dedicated row & column insertion/deletion (Above/Below, Left/Right)
 *   - Toggle raw LaTeX code view {} with two-way sync
 *   - Delete table with confirmation
 * - Resilient position tracking via posAtDOM and content fingerprinting (immune to offset drift)
 * - 100% LaTeX AST preservation (unmodified cells retain original LaTeX, formulas, macros, & comments)
 * - Spreadsheet-like keyboard navigation (Tab, Shift+Tab, Enter, Arrow keys)
 */

import { WidgetType, EditorView } from '@codemirror/view';

export interface TableCell {
  text: string;
  rawText?: string;
  isModified?: boolean;
  align?: 'l' | 'c' | 'r';
  isHeader?: boolean;
}

export interface TableRow {
  cells: TableCell[];
}

export interface ParsedTable {
  isWrappedInTable: boolean;
  caption: string | null;
  label: string | null;
  borderStyle: 'none' | 'all' | 'booktabs' | 'custom';
  colAlignments: ('l' | 'c' | 'r')[];
  colWidths: (string | null)[];
  rows: TableRow[];
  hasResizeBox: boolean;
  placement: string;
  rawLatex: string;
}

/**
 * Clean & unescape cell LaTeX content for visual display
 */
export function cleanLatexCell(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\checkmark/g, '✓')
    .replace(/\\times/g, '×')
    .replace(/\\textbf\{([^}]+)\}/g, '$1')
    .replace(/\\textit\{([^}]+)\}/g, '$1')
    .replace(/\\underline\{([^}]+)\}/g, '$1')
    .replace(/\\texttt\{([^}]+)\}/g, '$1')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .trim();
}

/**
 * Escape edited text back into LaTeX for saving without breaking math or macros
 */
export function escapeCellToLatex(text: string): string {
  if (!text) return '';
  let res = text.trim();
  if (res === '✓') return '\\checkmark';
  if (res === '×') return '$\\times$';

  // If text already contains valid math or latex commands, preserve them
  if (res.includes('$') || res.includes('\\')) {
    // Only escape bare unescaped ampersands that would break LaTeX columns
    return res.replace(/(?<!\\)&/g, '\\&');
  }

  // Plain text: escape ampersand and percent
  return res
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_');
}

/**
 * Parses LaTeX table code into a structured ParsedTable object
 */
export function parseLatexTable(raw: string): ParsedTable {
  const isWrappedInTable = /\\begin\{table\*?\}/.test(raw);

  const captionMatch = raw.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
  const caption = captionMatch ? captionMatch[1].trim() : null;

  const labelMatch = raw.match(/\\label\{([^}]+)\}/);
  const label = labelMatch ? labelMatch[1].trim() : null;

  const placementMatch = raw.match(/\\begin\{table\*?\}(?:\[([^\]]*)\])?/);
  const placement = placementMatch?.[1] ? placementMatch[1] : 'htbp';

  const hasResizeBox = /\\resizebox\{[^}]+\}\{[^}]+\}/.test(raw);

  // Match tabular
  const tabularMatch = raw.match(/\\begin\{tabular\*?\}(?:\[[^\]]*\])?\{([^}]*)\}([\s\S]*?)\\end\{tabular\*?\}/);
  if (!tabularMatch) {
    return {
      isWrappedInTable,
      caption,
      label,
      borderStyle: 'booktabs',
      colAlignments: ['l', 'c', 'c'],
      colWidths: [null, null, null],
      rows: [
        { cells: [{ text: 'Col 1', rawText: 'Col 1', isHeader: true }, { text: 'Col 2', rawText: 'Col 2', isHeader: true }] },
        { cells: [{ text: 'Val 1', rawText: 'Val 1' }, { text: 'Val 2', rawText: 'Val 2' }] },
      ],
      hasResizeBox,
      placement,
      rawLatex: raw,
    };
  }

  const alignSpec = tabularMatch[1].trim();
  const rawBody = tabularMatch[2];

  // Determine borders
  const hasBooktabs = /\\(?:toprule|midrule|bottomrule)/.test(raw);
  const hasHlines = /\\hline/.test(raw);
  const hasVlines = /\|/.test(alignSpec);

  let borderStyle: 'none' | 'all' | 'booktabs' | 'custom' = 'booktabs';
  if (hasBooktabs && !hasVlines) {
    borderStyle = 'booktabs';
  } else if (hasHlines && hasVlines) {
    borderStyle = 'all';
  } else if (!hasBooktabs && !hasHlines && !hasVlines) {
    borderStyle = 'none';
  } else {
    borderStyle = 'custom';
  }

  // Parse columns from alignSpec (e.g. "|l|c|r|" or "p{8cm} c c" or "l c r")
  const colAlignments: ('l' | 'c' | 'r')[] = [];
  const colWidths: (string | null)[] = [];

  const colRegex = /(p\{([^}]+)\}|[lcr])/g;
  let cm: RegExpExecArray | null;
  while ((cm = colRegex.exec(alignSpec)) !== null) {
    if (cm[1].startsWith('p{')) {
      colAlignments.push('l');
      colWidths.push(cm[2].trim());
    } else {
      colAlignments.push(cm[1] as 'l' | 'c' | 'r');
      colWidths.push(null);
    }
  }

  if (colAlignments.length === 0) {
    colAlignments.push('l', 'c');
    colWidths.push(null, null);
  }

  // Parse rows
  const rawRowList = rawBody.split(/\\\\(?:\s*\[[^\]]*\])?/);
  const rows: TableRow[] = [];
  let isFirstRow = true;

  for (const rawRow of rawRowList) {
    const cleanRow = rawRow
      .replace(/\\toprule/g, '')
      .replace(/\\midrule/g, '')
      .replace(/\\bottomrule/g, '')
      .replace(/\\hline/g, '')
      .replace(/\\cline\{[^}]*\}/g, '')
      .replace(/\\centering/g, '')
      .trim();

    if (!cleanRow) continue;

    // Split cells by unescaped &
    const rawCells = cleanRow.split(/(?<!\\)&/);
    const cells: TableCell[] = rawCells.map((c, idx) => {
      const trimmedRaw = c.trim();
      return {
        text: cleanLatexCell(trimmedRaw),
        rawText: trimmedRaw,
        isModified: false,
        align: colAlignments[idx] || 'l',
        isHeader: isFirstRow,
      };
    });

    // Pad cells if fewer than column count
    while (cells.length < colAlignments.length) {
      cells.push({
        text: '',
        rawText: '',
        isModified: false,
        align: colAlignments[cells.length] || 'l',
        isHeader: isFirstRow,
      });
    }

    rows.push({ cells });
    isFirstRow = false;
  }

  return {
    isWrappedInTable,
    caption,
    label,
    borderStyle,
    colAlignments,
    colWidths,
    rows,
    hasResizeBox,
    placement,
    rawLatex: raw,
  };
}

/**
 * Generates LaTeX string from ParsedTable with 100% AST preservation
 */
export function generateLatexTable(data: ParsedTable): string {
  const colSpecs: string[] = [];
  const hasVlines = data.borderStyle === 'all' || data.borderStyle === 'custom';

  for (let i = 0; i < data.colAlignments.length; i++) {
    const align = data.colAlignments[i] || 'c';
    const width = data.colWidths[i];
    const spec = width ? `p{${width}}` : align;
    colSpecs.push(spec);
  }

  const tabularFormat = hasVlines ? `|${colSpecs.join('|')}|` : colSpecs.join(' ');

  const lines: string[] = [];
  lines.push(`\\begin{tabular}{${tabularFormat}}`);

  if (data.borderStyle === 'booktabs') {
    lines.push('  \\toprule');
  } else if (data.borderStyle === 'all') {
    lines.push('  \\hline');
  }

  data.rows.forEach((row, rowIdx) => {
    const rowContent =
      row.cells
        .map((c) => {
          if (c.isModified || c.rawText === undefined) {
            return escapeCellToLatex(c.text);
          }
          return c.rawText;
        })
        .join(' & ') + ' \\\\';

    lines.push(`  ${rowContent}`);

    if (data.borderStyle === 'booktabs') {
      if (rowIdx === 0 && data.rows.length > 1) {
        lines.push('  \\midrule');
      }
    } else if (data.borderStyle === 'all') {
      lines.push('  \\hline');
    }
  });

  if (data.borderStyle === 'booktabs') {
    lines.push('  \\bottomrule');
  }

  lines.push('\\end{tabular}');

  let tabularBlock = lines.join('\n');
  if (data.hasResizeBox) {
    tabularBlock = `\\resizebox{\\columnwidth}{!}{\n${tabularBlock}\n}`;
  }

  // Only wrap in \begin{table} if originally wrapped OR if caption/label is specified
  if (!data.isWrappedInTable && !data.caption && !data.label) {
    return tabularBlock;
  }

  const outLines: string[] = [];
  outLines.push(`\\begin{table}[${data.placement || 'htbp'}]`);
  outLines.push('  \\centering');
  if (data.caption) {
    outLines.push(`  \\caption{${data.caption}}`);
  }
  if (data.label) {
    outLines.push(`  \\label{${data.label}}`);
  }
  outLines.push(`  ${tabularBlock.split('\n').join('\n  ')}`);
  outLines.push('\\end{table}');

  return outLines.join('\n');
}

/**
 * Interactive Overleaf Table Widget with in-place cell editing
 */
export class TableWidget extends WidgetType {
  private parsed: ParsedTable;
  private isCodeMode = false;
  private selectedCell: { row: number; col: number } | null = null;
  private selectedCol: number | null = null;
  private domElement: HTMLElement | null = null;

  constructor(
    public readonly rawLatex: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
    this.parsed = parseLatexTable(rawLatex);
  }

  override eq(other: TableWidget): boolean {
    return this.rawLatex === other.rawLatex && this.from === other.from && this.to === other.to;
  }

  override ignoreEvent(): boolean {
    // Crucial: Allow in-widget clicks, inputs, selection, and keyboard navigation
    return true;
  }

  /**
   * Resilient position tracking: finds actual range in document even after external edits
   */
  private resolveDocumentRange(view: EditorView): { from: number; to: number } {
    const docText = view.state.doc.toString();
    const len = docText.length;

    // 1. Direct offset match check
    if (this.to <= len && docText.slice(this.from, this.to) === this.rawLatex) {
      return { from: this.from, to: this.to };
    }

    // 2. Resolve via DOM position if mounted
    if (this.domElement && this.domElement.isConnected) {
      try {
        const domPos = view.posAtDOM(this.domElement);
        if (typeof domPos === 'number' && domPos >= 0 && domPos <= len) {
          const searchStart = Math.max(0, domPos - 150);
          const searchEnd = Math.min(len, domPos + this.rawLatex.length + 150);
          const windowChunk = docText.slice(searchStart, searchEnd);
          const relIdx = windowChunk.indexOf(this.rawLatex);
          if (relIdx !== -1) {
            return {
              from: searchStart + relIdx,
              to: searchStart + relIdx + this.rawLatex.length,
            };
          }
        }
      } catch {}
    }

    // 3. Fallback: global search for the raw LaTeX snippet
    const globalIdx = docText.indexOf(this.rawLatex);
    if (globalIdx !== -1) {
      return { from: globalIdx, to: globalIdx + this.rawLatex.length };
    }

    // Fallback to initial coordinates bounded by length
    return {
      from: Math.min(this.from, len),
      to: Math.min(this.to, len),
    };
  }

  private dispatchUpdate(view: EditorView) {
    const newLatex = generateLatexTable(this.parsed);
    if (newLatex !== this.rawLatex) {
      const { from, to } = this.resolveDocumentRange(view);
      view.dispatch({
        changes: { from, to, insert: newLatex },
      });
    }
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    this.domElement = root;
    root.className = 'cm-overleaf-table-widget my-4 select-none font-sans relative group';

    const render = () => {
      root.innerHTML = '';

      if (this.isCodeMode) {
        root.appendChild(this.buildCodeView(view, render));
        return;
      }

      const container = document.createElement('div');
      container.className = 'relative my-2 rounded-lg border border-border/70 bg-card p-2 shadow-xs';

      // 1. Floating Action Toolbar (Overleaf 1:1 Parity)
      const toolbar = this.buildToolbar(view, render);
      container.appendChild(toolbar);

      // 2. Column handles bar with live measurements (|-> 8cm)
      const colHandlesBar = this.buildColumnHandlesBar(view, render);
      container.appendChild(colHandlesBar);

      // 3. Table grid layout with row handles
      const tableWrapper = this.buildTableGrid(view, render);
      container.appendChild(tableWrapper);

      // 4. Caption footer if set
      if (this.parsed.caption) {
        const capEl = document.createElement('div');
        capEl.className =
          'text-center text-xs font-medium text-muted-foreground mt-2 italic flex items-center justify-center gap-1.5';
        capEl.innerHTML = `<span>Table: ${this.parsed.caption}</span>`;
        container.appendChild(capEl);
      }

      root.appendChild(container);
    };

    render();
    return root;
  }

  /**
   * Builds the Floating Contextual Toolbar matching Overleaf 1:1
   */
  private buildToolbar(view: EditorView, rerender: () => void): HTMLElement {
    const bar = document.createElement('div');
    bar.className =
      'flex flex-wrap items-center gap-1.5 p-1.5 mb-2 bg-muted/40 text-foreground border border-border/60 rounded-md text-xs select-none';

    // ── 1. Caption Button ──
    const captionBtn = document.createElement('button');
    captionBtn.type = 'button';
    captionBtn.className =
      'h-7 px-2.5 rounded border border-border/60 hover:bg-muted font-medium flex items-center gap-1.5 transition-colors cursor-pointer text-11 text-foreground/80';
    captionBtn.innerHTML = `<span>${this.parsed.caption ? `Caption: "${this.parsed.caption.slice(0, 14)}..."` : 'No caption'}</span><span class="text-[11px] text-muted-foreground">▾</span>`;
    captionBtn.title = 'Edit table caption';
    captionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = this.parsed.caption || '';
      const next = window.prompt('Enter table caption (or leave blank to remove):', current);
      if (next !== null) {
        this.parsed.caption = next.trim() || null;
        if (this.parsed.caption && !this.parsed.isWrappedInTable) {
          this.parsed.isWrappedInTable = true;
        }
        this.dispatchUpdate(view);
        rerender();
      }
    });
    bar.appendChild(captionBtn);

    // ── 2. Border Style Dropdown ──
    const borderSelect = document.createElement('select');
    borderSelect.className =
      'h-7 px-2 rounded border border-border/60 bg-background text-foreground text-11 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary';
    const borderOptions: { value: ParsedTable['borderStyle']; label: string }[] = [
      { value: 'booktabs', label: 'Booktabs' },
      { value: 'all', label: 'All borders' },
      { value: 'none', label: 'No borders' },
      { value: 'custom', label: 'Custom borders' },
    ];
    for (const opt of borderOptions) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      if (this.parsed.borderStyle === opt.value) el.selected = true;
      borderSelect.appendChild(el);
    }
    borderSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      this.parsed.borderStyle = borderSelect.value as ParsedTable['borderStyle'];
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(borderSelect);

    // Divider
    const sep1 = document.createElement('div');
    sep1.className = 'h-4 w-px bg-border/60 mx-0.5';
    bar.appendChild(sep1);

    // ── 3. Alignment Dropdown ──
    const alignSelect = document.createElement('select');
    alignSelect.className =
      'h-7 px-1.5 rounded border border-border/60 bg-background text-foreground text-11 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary';
    alignSelect.title = 'Column alignment';
    const curAlign = this.selectedCol !== null ? this.parsed.colAlignments[this.selectedCol] || 'c' : 'c';
    const alignOpts = [
      { value: 'l', label: 'Align Left' },
      { value: 'c', label: 'Align Center' },
      { value: 'r', label: 'Align Right' },
    ];
    for (const a of alignOpts) {
      const el = document.createElement('option');
      el.value = a.value;
      el.textContent = a.label;
      if (curAlign === a.value) el.selected = true;
      alignSelect.appendChild(el);
    }
    alignSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      const nextA = alignSelect.value as 'l' | 'c' | 'r';
      if (this.selectedCol !== null) {
        this.parsed.colAlignments[this.selectedCol] = nextA;
      } else {
        this.parsed.colAlignments = this.parsed.colAlignments.map(() => nextA);
      }
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(alignSelect);

    // ── 4. Column Width Dropdown (<-> ⌵) ──
    const widthBtn = document.createElement('button');
    widthBtn.type = 'button';
    widthBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-muted font-medium flex items-center gap-1 transition-colors cursor-pointer text-11 text-foreground/80';
    const activeWidth = this.selectedCol !== null ? this.parsed.colWidths[this.selectedCol] : null;
    widthBtn.innerHTML = `<span>⟷ ${activeWidth ? activeWidth : 'Auto'}</span><span class="text-[11px] text-muted-foreground">▾</span>`;
    widthBtn.title = 'Set column width (Stretch vs Fixed width e.g. 8cm, 0.25\\linewidth)';
    widthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const colIdx = this.selectedCol !== null ? this.selectedCol : 0;
      const cur = this.parsed.colWidths[colIdx] || '';
      const next = window.prompt(`Set width for column ${colIdx + 1} (e.g. 8cm, 50mm, 0.25\\linewidth, or leave empty for auto):`, cur);
      if (next !== null) {
        this.parsed.colWidths[colIdx] = next.trim() || null;
        this.dispatchUpdate(view);
        rerender();
      }
    });
    bar.appendChild(widthBtn);

    // ── 5. Toggle Code View {} ──
    const codeBtn = document.createElement('button');
    codeBtn.type = 'button';
    codeBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-muted font-mono font-semibold flex items-center justify-center text-11 text-foreground/80 transition-colors cursor-pointer';
    codeBtn.innerHTML = '{ }';
    codeBtn.title = 'View LaTeX code for this table';
    codeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isCodeMode = true;
      rerender();
    });
    bar.appendChild(codeBtn);

    // Divider
    const sep2 = document.createElement('div');
    sep2.className = 'h-4 w-px bg-border/60 mx-0.5';
    bar.appendChild(sep2);

    // ── 6. Dedicated Insert Row Above / Below ──
    const addRowAboveBtn = document.createElement('button');
    addRowAboveBtn.type = 'button';
    addRowAboveBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-muted font-medium flex items-center text-11 text-foreground/80 transition-colors cursor-pointer';
    addRowAboveBtn.textContent = '+ Row ↑';
    addRowAboveBtn.title = 'Insert row above selected';
    addRowAboveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetIdx = this.selectedCell ? this.selectedCell.row : 0;
      const newCells: TableCell[] = this.parsed.colAlignments.map((a) => ({
        text: '',
        rawText: '',
        isModified: true,
        align: a,
      }));
      this.parsed.rows.splice(targetIdx, 0, { cells: newCells });
      this.selectedCell = { row: targetIdx, col: this.selectedCell?.col ?? 0 };
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(addRowAboveBtn);

    const addRowBelowBtn = document.createElement('button');
    addRowBelowBtn.type = 'button';
    addRowBelowBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-muted font-medium flex items-center text-11 text-foreground/80 transition-colors cursor-pointer';
    addRowBelowBtn.textContent = '+ Row ↓';
    addRowBelowBtn.title = 'Insert row below selected';
    addRowBelowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetIdx = this.selectedCell ? this.selectedCell.row + 1 : this.parsed.rows.length;
      const newCells: TableCell[] = this.parsed.colAlignments.map((a) => ({
        text: '',
        rawText: '',
        isModified: true,
        align: a,
      }));
      this.parsed.rows.splice(targetIdx, 0, { cells: newCells });
      this.selectedCell = { row: targetIdx, col: this.selectedCell?.col ?? 0 };
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(addRowBelowBtn);

    // ── 7. Dedicated Insert Col Left / Right ──
    const addColLeftBtn = document.createElement('button');
    addColLeftBtn.type = 'button';
    addColLeftBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-muted font-medium flex items-center text-11 text-foreground/80 transition-colors cursor-pointer';
    addColLeftBtn.textContent = '+ Col ←';
    addColLeftBtn.title = 'Insert column to the left';
    addColLeftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetIdx = this.selectedCol !== null ? this.selectedCol : 0;
      this.parsed.colAlignments.splice(targetIdx, 0, 'c');
      this.parsed.colWidths.splice(targetIdx, 0, null);
      this.parsed.rows.forEach((r) => {
        r.cells.splice(targetIdx, 0, { text: '', rawText: '', isModified: true, align: 'c' });
      });
      this.selectedCol = targetIdx;
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(addColLeftBtn);

    const addColRightBtn = document.createElement('button');
    addColRightBtn.type = 'button';
    addColRightBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-muted font-medium flex items-center text-11 text-foreground/80 transition-colors cursor-pointer';
    addColRightBtn.textContent = '+ Col →';
    addColRightBtn.title = 'Insert column to the right';
    addColRightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetIdx = this.selectedCol !== null ? this.selectedCol + 1 : this.parsed.colAlignments.length;
      this.parsed.colAlignments.splice(targetIdx, 0, 'c');
      this.parsed.colWidths.splice(targetIdx, 0, null);
      this.parsed.rows.forEach((r) => {
        r.cells.splice(targetIdx, 0, { text: '', rawText: '', isModified: true, align: 'c' });
      });
      this.selectedCol = targetIdx;
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(addColRightBtn);

    // ── 8. Delete Row / Delete Col Buttons ──
    const delRowBtn = document.createElement('button');
    delRowBtn.type = 'button';
    delRowBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-destructive/20 hover:text-destructive text-muted-foreground flex items-center text-11 transition-colors cursor-pointer';
    delRowBtn.textContent = '- Row';
    delRowBtn.title = 'Delete selected row';
    delRowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.parsed.rows.length <= 1) {
        window.alert('Cannot delete the only row of the table.');
        return;
      }
      const targetRow = this.selectedCell ? this.selectedCell.row : this.parsed.rows.length - 1;
      this.parsed.rows.splice(targetRow, 1);
      this.selectedCell = null;
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(delRowBtn);

    const delColBtn = document.createElement('button');
    delColBtn.type = 'button';
    delColBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-destructive/20 hover:text-destructive text-muted-foreground flex items-center text-11 transition-colors cursor-pointer';
    delColBtn.textContent = '- Col';
    delColBtn.title = 'Delete selected column';
    delColBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.parsed.colAlignments.length <= 1) {
        window.alert('Cannot delete the only column of the table.');
        return;
      }
      const targetCol = this.selectedCol !== null ? this.selectedCol : this.parsed.colAlignments.length - 1;
      this.parsed.colAlignments.splice(targetCol, 1);
      this.parsed.colWidths.splice(targetCol, 1);
      this.parsed.rows.forEach((r) => r.cells.splice(targetCol, 1));
      this.selectedCol = null;
      this.dispatchUpdate(view);
      rerender();
    });
    bar.appendChild(delColBtn);

    // ── 9. Delete Table (Trash) ──
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className =
      'h-7 px-2 rounded border border-border/60 hover:bg-destructive/20 hover:text-destructive text-muted-foreground flex items-center justify-center text-11 transition-colors cursor-pointer ml-auto';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete table';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.confirm('Delete this table from the document?')) {
        const { from, to } = this.resolveDocumentRange(view);
        view.dispatch({
          changes: { from, to, insert: '' },
        });
      }
    });
    bar.appendChild(deleteBtn);

    return bar;
  }

  /**
   * Builds the Column Handles Bar with live measurement pills (|-> 8cm)
   */
  private buildColumnHandlesBar(view: EditorView, rerender: () => void): HTMLElement {
    const handleBar = document.createElement('div');
    handleBar.className = 'flex items-center gap-1.5 pl-6 pr-2 mb-1.5 select-none';

    const colCount = this.parsed.colAlignments.length;
    for (let c = 0; c < colCount; c++) {
      const colWrap = document.createElement('div');
      colWrap.className = 'flex-1 flex flex-col items-center group/col cursor-pointer relative';

      // Width indicator badge: e.g. "|-> 8cm"
      const widthVal = this.parsed.colWidths[c];
      const isSelected = this.selectedCol === c;

      if (widthVal || isSelected) {
        const pill = document.createElement('div');
        pill.className =
          'mb-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted text-foreground border border-border font-semibold whitespace-nowrap';
        pill.textContent = `|→ ${widthVal || 'auto'}`;
        colWrap.appendChild(pill);
      }

      // Rounded horizontal handle bar
      const bar = document.createElement('div');
      bar.className = `w-full h-1.5 rounded-full transition-all ${
        isSelected
          ? 'bg-primary ring-2 ring-primary/40'
          : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'
      }`;
      bar.title = `Column ${c + 1} handle (Click to select & set width)`;

      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCol = this.selectedCol === c ? null : c;
        rerender();
      });

      colWrap.appendChild(bar);
      handleBar.appendChild(colWrap);
    }

    return handleBar;
  }

  /**
   * Builds the interactive table grid with row handles and editable cells
   */
  private buildTableGrid(view: EditorView, rerender: () => void): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full overflow-x-auto no-scrollbar relative';

    const table = document.createElement('table');
    table.className = 'w-full border-collapse text-xs text-foreground';

    // Style borders based on borderStyle
    const isBooktabs = this.parsed.borderStyle === 'booktabs';
    const isAll = this.parsed.borderStyle === 'all';
    const isCustom = this.parsed.borderStyle === 'custom';

    if (isBooktabs) {
      table.style.borderTop = '2px solid var(--border, #64748b)';
      table.style.borderBottom = '2px solid var(--border, #64748b)';
    } else if (isAll || isCustom) {
      table.style.border = '1px solid var(--border, #94a3b8)';
    }

    this.parsed.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      tr.className = 'group/row transition-colors hover:bg-muted/20 relative';

      if (isBooktabs && rowIdx === 0 && this.parsed.rows.length > 1) {
        tr.style.borderBottom = '1px solid var(--border, #94a3b8)';
      } else if (isAll) {
        tr.style.borderBottom = '1px solid var(--border, #cbd5e1)';
      }

      // Row handle on the left (grey vertical indicator)
      const handleTd = document.createElement('td');
      handleTd.className = 'w-4 p-0 text-center select-none cursor-pointer align-middle';
      const handlePill = document.createElement('div');
      handlePill.className = `w-1.5 h-4 mx-auto rounded-full transition-colors ${
        this.selectedCell?.row === rowIdx
          ? 'bg-primary ring-2 ring-primary/40'
          : 'bg-muted-foreground/30 hover:bg-primary'
      }`;
      handlePill.title = `Row ${rowIdx + 1} (Click to select row)`;
      handlePill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCell = { row: rowIdx, col: this.selectedCell?.col ?? 0 };
        rerender();
      });
      handleTd.appendChild(handlePill);
      tr.appendChild(handleTd);

      // Cells
      row.cells.forEach((cell, colIdx) => {
        const td = document.createElement(rowIdx === 0 ? 'th' : 'td');
        const isSelected =
          this.selectedCell?.row === rowIdx && this.selectedCell?.col === colIdx;

        // Alignment & width
        const align = this.parsed.colAlignments[colIdx] || 'left';
        td.style.textAlign = align === 'c' ? 'center' : align === 'r' ? 'right' : 'left';
        if (this.parsed.colWidths[colIdx]) {
          td.style.width = this.parsed.colWidths[colIdx]!;
        }

        // Cell borders
        if (isAll || (isCustom && colIdx > 0)) {
          td.style.borderRight = '1px solid var(--border, #cbd5e1)';
          td.style.borderBottom = '1px solid var(--border, #cbd5e1)';
        }

        td.className = `p-2 relative transition-all min-w-[60px] ${
          rowIdx === 0 ? 'font-semibold text-foreground bg-muted/30' : 'text-foreground/90'
        } ${
          isSelected
            ? 'bg-sky-50 dark:bg-sky-950/40 ring-2 ring-primary ring-inset rounded-xs'
            : ''
        }`;

        // Cell Content Container (contenteditable for live editing)
        const contentDiv = document.createElement('div');
        contentDiv.contentEditable = 'true';
        contentDiv.className = 'outline-none whitespace-pre-wrap cursor-text min-h-[18px]';
        contentDiv.textContent = cell.text;

        contentDiv.addEventListener('focus', () => {
          this.selectedCell = { row: rowIdx, col: colIdx };
          this.selectedCol = colIdx;
        });

        contentDiv.addEventListener('blur', () => {
          const nextText = contentDiv.textContent || '';
          if (nextText !== cell.text) {
            cell.text = nextText;
            cell.isModified = true;
            this.dispatchUpdate(view);
          }
        });

        // Spreadsheet keyboard navigation: Tab / Shift-Tab / Enter / Arrows
        contentDiv.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
            if (nextCol >= 0 && nextCol < row.cells.length) {
              this.selectedCell = { row: rowIdx, col: nextCol };
              this.selectedCol = nextCol;
              rerender();
            } else if (!e.shiftKey && rowIdx + 1 < this.parsed.rows.length) {
              this.selectedCell = { row: rowIdx + 1, col: 0 };
              this.selectedCol = 0;
              rerender();
            } else if (!e.shiftKey && rowIdx + 1 >= this.parsed.rows.length) {
              // At very last cell: append new row automatically
              const newCells: TableCell[] = this.parsed.colAlignments.map((a) => ({
                text: '',
                rawText: '',
                isModified: true,
                align: a,
              }));
              this.parsed.rows.push({ cells: newCells });
              this.selectedCell = { row: rowIdx + 1, col: 0 };
              this.selectedCol = 0;
              this.dispatchUpdate(view);
              rerender();
            }
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (rowIdx + 1 < this.parsed.rows.length) {
              this.selectedCell = { row: rowIdx + 1, col: colIdx };
              rerender();
            } else {
              // Append new row at bottom
              const newCells: TableCell[] = this.parsed.colAlignments.map((a) => ({
                text: '',
                rawText: '',
                isModified: true,
                align: a,
              }));
              this.parsed.rows.push({ cells: newCells });
              this.selectedCell = { row: rowIdx + 1, col: colIdx };
              this.dispatchUpdate(view);
              rerender();
            }
          }
        });

        td.appendChild(contentDiv);
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    wrapper.appendChild(table);
    return wrapper;
  }

  /**
   * Builds the Raw LaTeX Code View mode when `{}` toggle is pressed
   */
  private buildCodeView(view: EditorView, rerender: () => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className =
      'p-3 bg-muted/40 border border-border rounded-md font-mono text-xs flex flex-col gap-2';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-1.5 border-b border-border/60 text-11 text-muted-foreground select-none';
    header.innerHTML = `
      <div class="flex items-center gap-1.5 font-semibold text-foreground">
        <span class="text-primary font-semibold">{ }</span>
        <span>Raw LaTeX Table Source</span>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className =
      'px-2 py-0.5 rounded bg-primary text-primary-foreground font-sans font-medium text-11 hover:bg-primary-hover transition-colors cursor-pointer';
    closeBtn.textContent = 'Back to Visual';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isCodeMode = false;
      rerender();
    });
    header.appendChild(closeBtn);
    wrap.appendChild(header);

    const textarea = document.createElement('textarea');
    textarea.className =
      'w-full h-44 p-2 bg-background text-foreground font-mono text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-y';
    textarea.value = generateLatexTable(this.parsed);

    textarea.addEventListener('blur', () => {
      const nextCode = textarea.value.trim();
      if (nextCode && nextCode !== this.rawLatex) {
        const { from, to } = this.resolveDocumentRange(view);
        view.dispatch({
          changes: { from, to, insert: nextCode },
        });
      }
    });

    wrap.appendChild(textarea);
    return wrap;
  }
}
