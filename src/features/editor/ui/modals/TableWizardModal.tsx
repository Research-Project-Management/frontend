'use client';

/**
 * TableWizardModal.tsx
 *
 * Visual LaTeX Table & Math Matrix Editor Wizard (Overleaf Parity).
 * Location: `features/editor/ui/modals/TableWizardModal.tsx`
 *
 * Features:
 * 1. Interactive Visual Spreadsheet Grid (edit cell contents without typing `&` and `\\`).
 * 2. Academic Booktabs, Bordered, and Minimal table styling.
 * 3. Matrix Wizard: pmatrix, bmatrix, vmatrix, Bmatrix, Vmatrix, matrix.
 * 4. Matrix presets: Identity (I), Zero (0), Symbolic (a_{ij}), Diagonal.
 * 5. Excel / Google Sheets CSV/TSV copy-paste import.
 * 6. Reverse-parser from existing LaTeX tabular & matrix snippets.
 * 7. Live syntax-highlighted LaTeX output and rendered KaTeX preview.
 */

import React, { useMemo } from 'react';
import {
  Table as TableIcon,
  Check,
  Copy,
  Plus,
  Trash2,
  Grid3X3,
  FileSpreadsheet,
  Variable,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useTableMatrixWizard } from './hooks/useTableMatrixWizard';
import { type MatrixType, type TableAlignment } from '@/features/editor/domain/latex/table-matrix';
import katex from 'katex';

export interface TableWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexCode: string) => void;
  initialTab?: 'table' | 'matrix';
  initialLatex?: string;
}

export function TableWizardModal({
  open,
  onOpenChange,
  onInsert,
  initialTab = 'table',
  initialLatex = '',
}: TableWizardModalProps) {
  const {
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

    // Output & Actions
    activeLatex,
    insertSnippet,
    copySnippet,
  } = useTableMatrixWizard({
    onInsert,
    onClose: () => onOpenChange(false),
    initialTab,
    initialLatex,
  });

  // Render live KaTeX preview for matrix
  const renderedMatrixHtml = useMemo(() => {
    if (tab !== 'matrix') return '';
    try {
      const rowStrings: string[] = [];
      for (let r = 0; r < matrixRows; r++) {
        const row = matrixCells[r] || [];
        const formattedCells = Array.from({ length: matrixCols }, (_, c) => {
          const val = row[c] ?? '';
          return val.trim() || '0';
        });
        rowStrings.push(formattedCells.join(' & '));
      }
      const rawMatrix = `\\begin{${matrixType}}${rowStrings.join(' \\\\ ')}\\end{${matrixType}}`;
      return katex.renderToString(rawMatrix, { displayMode: true, throwOnError: false });
    } catch {
      return '';
    }
  }, [tab, matrixType, matrixRows, matrixCols, matrixCells]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-5 gap-3 text-xs bg-background border border-border shadow-raised-300 rounded-lg">
        {/* Header */}
        <DialogHeader className="pb-1 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {tab === 'table' ? (
                  <TableIcon className="size-4" />
                ) : (
                  <Variable className="size-4" />
                )}
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold">
                  Visual LaTeX Table & Matrix Wizard
                </DialogTitle>
                <DialogDescription className="text-11 text-muted-foreground">
                  Construct tabular layouts and math matrices visually without typing manual ampersands (&amp;) or linebreaks (\\).
                </DialogDescription>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'table' | 'matrix')}
              className="shrink-0"
            >
              <TabsList className="h-7 bg-muted p-0.5 border border-border rounded-md">
                <TabsTrigger
                  value="table"
                  className="text-xs h-6 px-3 rounded-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <TableIcon className="size-3.5" />
                  Table (Tabular)
                </TabsTrigger>
                <TabsTrigger
                  value="matrix"
                  className="text-xs h-6 px-3 rounded-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Variable className="size-3.5" />
                  Math Matrix
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        {/* Tab 1: Table Wizard Content */}
        {tab === 'table' && (
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
            {/* Top Toolbar: Dimensions & Table Style */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-muted/20 border border-border rounded-md">
              {/* Dimensions */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Grid:
                </span>
                <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {tableRows} rows × {tableCols} cols
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={tableRows}
                    onChange={(e) => setTableDimension(parseInt(e.target.value) || 1, tableCols)}
                    className="w-14 h-7 text-xs font-mono text-center"
                    aria-label="Rows"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={tableCols}
                    onChange={(e) => setTableDimension(tableRows, parseInt(e.target.value) || 1)}
                    className="w-14 h-7 text-xs font-mono text-center"
                    aria-label="Columns"
                  />
                </div>
              </div>

              {/* Table Style Selector */}
              <div className="flex items-center gap-2">
                <span className="text-11 font-medium text-muted-foreground">Style:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'booktabs', label: 'Booktabs (Academic)' },
                    { id: 'bordered', label: 'Bordered (\\hline)' },
                    { id: 'minimal', label: 'Minimal' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTableStyle(s.id as any)}
                      className={cn(
                        'h-6 px-2 text-11 font-medium rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        tableStyle === s.id
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Spreadsheet Grid */}
            <div className="border border-border rounded-md bg-background overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 bg-muted/40 border-b border-border flex items-center justify-between text-11 font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Grid3X3 className="size-3.5" />
                  Interactive Cell Editor (Click to edit text, Tab to move)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addTableColumn()}
                    className="px-2 py-0.5 text-11 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="size-3" /> Add Column
                  </button>
                  <button
                    type="button"
                    onClick={() => addTableRow()}
                    className="px-2 py-0.5 text-11 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="size-3" /> Add Row
                  </button>
                </div>
              </div>

              {/* Grid Scroll Container */}
              <div className="max-h-56 overflow-auto p-2">
                <table className="w-full border-collapse text-xs">
                  {/* Column Alignment Controls */}
                  <thead>
                    <tr className="border-b border-border/80">
                      <th className="w-8 p-1 text-center font-mono text-10 text-muted-foreground select-none">
                        #
                      </th>
                      {Array.from({ length: tableCols }, (_, cIdx) => (
                        <th key={`align-${cIdx}`} className="p-1 min-w-[100px]">
                          <div className="flex items-center justify-between gap-1 px-1 py-0.5 bg-muted/40 rounded border border-border/50">
                            <button
                              type="button"
                              onClick={() => toggleColumnAlignment(cIdx)}
                              className="px-1.5 py-0.5 text-10 font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded cursor-pointer transition-colors"
                              title={`Click to cycle alignment: currently [${tableAlignments[cIdx]?.toUpperCase() || 'C'}]`}
                            >
                              [{tableAlignments[cIdx]?.toUpperCase() || 'C'}]
                            </button>
                            <span className="text-10 text-muted-foreground">Col {cIdx + 1}</span>
                            {tableCols > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTableColumn(cIdx)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer p-0.5 rounded"
                                title="Remove Column"
                              >
                                <Trash2 className="size-2.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>

                    {/* Header Row */}
                    {hasHeaderRow && (
                      <tr className="bg-muted/30 border-b border-border">
                        <td className="w-8 p-1 text-center font-mono text-10 text-muted-foreground select-none">
                          H
                        </td>
                        {Array.from({ length: tableCols }, (_, cIdx) => (
                          <td key={`h-${cIdx}`} className="p-1">
                            <Input
                              value={tableHeaders[cIdx] || ''}
                              onChange={(e) => updateTableHeader(cIdx, e.target.value)}
                              placeholder={`Header ${cIdx + 1}`}
                              className="h-7 text-xs font-semibold rounded border-border bg-background focus:ring-1 focus:ring-primary"
                            />
                          </td>
                        ))}
                        <td className="w-8" />
                      </tr>
                    )}
                  </thead>

                  {/* Body Data Rows */}
                  <tbody>
                    {Array.from({ length: tableRows }, (_, rIdx) => (
                      <tr key={`r-${rIdx}`} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="w-8 p-1 text-center font-mono text-10 text-muted-foreground select-none">
                          {rIdx + 1}
                        </td>
                        {Array.from({ length: tableCols }, (_, cIdx) => (
                          <td key={`cell-${rIdx}-${cIdx}`} className="p-1">
                            <Input
                              value={tableData[rIdx]?.[cIdx] ?? ''}
                              onChange={(e) => updateTableCell(rIdx, cIdx, e.target.value)}
                              placeholder={`r${rIdx + 1}, c${cIdx + 1}`}
                              className="h-7 text-xs rounded border-border/80 bg-background focus:ring-1 focus:ring-primary"
                            />
                          </td>
                        ))}
                        <td className="w-8 p-1 text-center">
                          {tableRows > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTableRow(rIdx)}
                              className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded transition-colors"
                              title="Delete Row"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Metadata & Import Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Metadata */}
              <div className="p-2.5 bg-muted/20 border border-border rounded-md space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-11 font-medium text-muted-foreground mb-0.5 block">
                      Caption
                    </label>
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Table caption"
                      className="h-7 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-11 font-medium text-muted-foreground mb-0.5 block">
                      Label (\ref)
                    </label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="tab:results"
                      className="h-7 text-xs font-mono bg-background"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="centering"
                      checked={centering}
                      onCheckedChange={(c) => setCentering(Boolean(c))}
                    />
                    <label htmlFor="centering" className="text-11 font-medium cursor-pointer">
                      Center (\centering)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="header-toggle"
                      checked={hasHeaderRow}
                      onCheckedChange={(c) => setHasHeaderRow(Boolean(c))}
                    />
                    <label htmlFor="header-toggle" className="text-11 font-medium cursor-pointer">
                      Header row
                    </label>
                  </div>
                </div>
              </div>

              {/* Paste / Import */}
              <div className="p-2.5 bg-muted/20 border border-border rounded-md space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-11 font-medium text-muted-foreground flex items-center gap-1">
                    <FileSpreadsheet className="size-3.5" />
                    Paste Excel / CSV / LaTeX Code:
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={importPastedData}
                    disabled={!pastedText.trim()}
                    className="h-6 text-10 px-2 cursor-pointer font-medium"
                  >
                    Import to Grid
                  </Button>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste TSV (from Excel), CSV, or \begin{tabular} snippet..."
                  rows={2}
                  className="w-full p-1.5 text-11 font-mono rounded border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Matrix Wizard Content */}
        {tab === 'matrix' && (
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
            {/* Matrix Type Selector & Dimensions */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-muted/20 border border-border rounded-md">
              {/* Bracket Type */}
              <div className="space-y-1">
                <span className="text-11 font-medium text-muted-foreground block">
                  Matrix Bracket Style:
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'pmatrix', label: '( ) pmatrix' },
                    { id: 'bmatrix', label: '[ ] bmatrix' },
                    { id: 'vmatrix', label: '| | vmatrix' },
                    { id: 'Bmatrix', label: '{ } Bmatrix' },
                    { id: 'Vmatrix', label: '‖ ‖ Vmatrix' },
                    { id: 'matrix', label: 'plain' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMatrixType(m.id as MatrixType)}
                      className={cn(
                        'h-6 px-2 text-11 font-mono font-medium rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        matrixType === m.id
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-1">
                <span className="text-11 font-medium text-muted-foreground block">
                  Dimensions:
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={matrixRows}
                    onChange={(e) => setMatrixDimension(parseInt(e.target.value) || 1, matrixCols)}
                    className="w-12 h-6 text-xs font-mono text-center"
                    aria-label="Matrix rows"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={matrixCols}
                    onChange={(e) => setMatrixDimension(matrixRows, parseInt(e.target.value) || 1)}
                    className="w-12 h-6 text-xs font-mono text-center"
                    aria-label="Matrix columns"
                  />
                </div>
              </div>
            </div>

            {/* Presets Bar */}
            <div className="flex items-center gap-2 p-2 bg-muted/10 border border-border rounded-md">
              <span className="text-11 font-semibold text-muted-foreground flex items-center gap-1">
                <Layers className="size-3.5" /> Presets:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyMatrixPreset('identity')}
                  className="px-2 py-0.5 text-11 bg-background hover:bg-muted border border-border rounded cursor-pointer font-medium"
                >
                  Identity (I)
                </button>
                <button
                  type="button"
                  onClick={() => applyMatrixPreset('zero')}
                  className="px-2 py-0.5 text-11 bg-background hover:bg-muted border border-border rounded cursor-pointer font-medium"
                >
                  Zero (0)
                </button>
                <button
                  type="button"
                  onClick={() => applyMatrixPreset('symbolic')}
                  className="px-2 py-0.5 text-11 bg-background hover:bg-muted border border-border rounded cursor-pointer font-medium"
                >
                  Symbolic (a_ij)
                </button>
                <button
                  type="button"
                  onClick={() => applyMatrixPreset('diagonal')}
                  className="px-2 py-0.5 text-11 bg-background hover:bg-muted border border-border rounded cursor-pointer font-medium"
                >
                  Diagonal
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-11 font-medium text-muted-foreground">Wrap:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'display', label: '\\[ \\]' },
                    { id: 'inline', label: '$ $' },
                    { id: 'equation', label: '\\begin{eq}' },
                    { id: 'raw', label: 'raw' },
                  ].map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setMatrixWrapper(w.id as any)}
                      className={cn(
                        'h-6 px-1.5 text-10 font-mono rounded border transition-colors cursor-pointer',
                        matrixWrapper === w.id
                          ? 'bg-primary text-primary-foreground border-primary font-bold'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Matrix Coefficient Grid & Live KaTeX Preview Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Coefficient Inputs Grid */}
              <div className="border border-border rounded-md bg-background p-2.5 flex flex-col justify-center">
                <span className="text-11 font-semibold text-muted-foreground mb-2 block">
                  Coefficient Grid ({matrixRows} × {matrixCols}):
                </span>
                <div
                  className="grid gap-1.5 max-h-48 overflow-auto p-1"
                  style={{
                    gridTemplateColumns: `repeat(${matrixCols}, minmax(40px, 1fr))`,
                  }}
                >
                  {Array.from({ length: matrixRows }).map((_, rIdx) =>
                    Array.from({ length: matrixCols }).map((_, cIdx) => (
                      <Input
                        key={`mat-${rIdx}-${cIdx}`}
                        value={matrixCells[rIdx]?.[cIdx] ?? ''}
                        onChange={(e) => updateMatrixCell(rIdx, cIdx, e.target.value)}
                        placeholder={`a_${rIdx + 1}${cIdx + 1}`}
                        className="h-7 text-xs font-mono text-center rounded border-border bg-background focus:ring-1 focus:ring-primary p-0.5"
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Rendered Math Preview */}
              <div className="border border-border rounded-md bg-muted/10 p-3 flex flex-col items-center justify-center min-h-[120px] overflow-auto select-none">
                <span className="text-10 font-medium text-muted-foreground mb-1 block self-start">
                  Live KaTeX Rendered Output:
                </span>
                <div
                  className="py-2 text-foreground"
                  dangerouslySetInnerHTML={{ __html: renderedMatrixHtml }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Live LaTeX Code Output Preview */}
        <div className="border border-border rounded-md bg-muted/15 p-2 font-mono text-11 max-h-24 overflow-y-auto select-all shrink-0">
          <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
            {activeLatex}
          </pre>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copySnippet}
            className="gap-1.5 h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <Copy className="size-3.5" />
            Copy Code
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={insertSnippet}
              className="gap-1.5 h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Check className="size-3.5" />
              {tab === 'table' ? 'Insert Table' : 'Insert Matrix'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TableWizardModal;
