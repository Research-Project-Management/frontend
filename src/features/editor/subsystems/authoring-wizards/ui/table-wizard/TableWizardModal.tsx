'use client';

/**
 * TableWizardModal.tsx
 *
 * Overleaf-aligned Table Insertion & Customization Modal:
 * - Table tab: clean blank interactive grid, column alignments, horizontal merge/unmerge,
 *   border toggles (Booktabs / Outer / Horizontal / Vertical), and Caption/Label fields.
 * - Import tab: paste Excel/TSV, CSV, or LaTeX tabular snippet into the visual grid.
 * - Create with AI tab: natural language prompt and image upload / drag-and-drop.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Table as TableIcon,
  Check,
  Plus,
  Trash2,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  Merge,
  Split,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
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
} from '@/shared/components/ui/tabs';
import { cn } from '@/shared/lib/utils';
import {
  useTableMatrixWizard,
  type TableWizardTab,
} from './useTableMatrixWizard';
import type { TableCellMerge } from '@/features/editor/domain/latex/table-matrix';

export interface TableWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexCode: string) => void;
  initialTab?: 'table' | 'import' | 'ai' | 'matrix';
  initialLatex?: string;
}

interface CellSelection {
  row: number;
  anchorCol: number;
  focusCol: number;
}

function getMergeAt(
  merges: TableCellMerge[],
  row: number,
  col: number,
): TableCellMerge | undefined {
  return merges.find(
    (m) => m.row === row && col >= m.col && col < m.col + m.colSpan,
  );
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
    tableRows,
    tableCols,
    tableHeaders,
    tableData,
    tableAlignments,
    tableStyle,
    merges,
    borders,
    mergeCells,
    unmergeCell,
    toggleBorder,
    applyBooktabsPreset,
    caption,
    setCaption,
    label,
    setLabel,
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
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    importPastedData,
    importRawText,
    insertSnippet,
  } = useTableMatrixWizard({
    onInsert,
    onClose: () => onOpenChange(false),
    initialTab,
    initialLatex,
  });

  const aiAssistEnabled = useSettingsStore((s) => s.aiAssistEnabled);
  const activeTab: TableWizardTab = !aiAssistEnabled && tab === 'ai' ? 'table' : tab;

  // ── Horizontal Cell Selection (click + Shift+click across a row) ──────────
  const [selection, setSelection] = useState<CellSelection | null>(null);

  const handleCellPointerDown = (
    e: React.MouseEvent<HTMLInputElement>,
    row: number,
    col: number,
  ) => {
    const existingMerge = getMergeAt(merges, row, col);
    if (e.shiftKey && selection && selection.row === row) {
      if (selection.anchorCol !== col) {
        e.preventDefault();
      }
      const targetCol = existingMerge
        ? existingMerge.col + existingMerge.colSpan - 1
        : col;
      setSelection({ ...selection, focusCol: targetCol });
      return;
    }

    if (existingMerge) {
      setSelection({
        row,
        anchorCol: existingMerge.col,
        focusCol: existingMerge.col + existingMerge.colSpan - 1,
      });
    } else {
      setSelection({ row, anchorCol: col, focusCol: col });
    }
  };

  const validSelection =
    selection &&
    selection.row < tableRows &&
    (selection.row !== -1 || hasHeaderRow)
      ? selection
      : null;

  const selStartCol = validSelection
    ? Math.max(0, Math.min(validSelection.anchorCol, validSelection.focusCol))
    : -1;
  const selEndCol = validSelection
    ? Math.min(tableCols - 1, Math.max(validSelection.anchorCol, validSelection.focusCol))
    : -1;

  const activeSelectedMerge =
    validSelection && selStartCol >= 0
      ? getMergeAt(merges, validSelection.row, selStartCol)
      : undefined;

  const isSingleMergedSelection = Boolean(
    activeSelectedMerge &&
      validSelection &&
      selStartCol >= activeSelectedMerge.col &&
      selEndCol < activeSelectedMerge.col + activeSelectedMerge.colSpan,
  );

  const canMergeSelection = Boolean(
    validSelection && selEndCol > selStartCol && !isSingleMergedSelection,
  );

  const isBooktabsActive =
    tableStyle === 'booktabs' &&
    !borders.outer &&
    !borders.innerHorizontal &&
    !borders.innerVertical;

  // ── AI Table Generator State (Text Prompt + Image Upload / Drag & Drop) ───
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearUploadedImage = useCallback(() => {
    setUploadedImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedImage?.previewUrl) {
        URL.revokeObjectURL(uploadedImage.previewUrl);
      }
    };
  }, [uploadedImage]);

  const handleImageSelected = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, etc.)', {
        id: 'ai-table-image',
      });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setUploadedImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl };
    });
  };

  const handleGenerateAiTable = useCallback(async () => {
    if ((!aiPrompt.trim() && !uploadedImage) || isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const promptParts: string[] = [];
      if (aiPrompt.trim()) {
        promptParts.push(aiPrompt.trim());
      }
      if (uploadedImage) {
        promptParts.push(`[Attached table image: ${uploadedImage.file.name}]`);
      }
      const clean = await pagesService.ai.generateLatexTable(
        promptParts.join('\n\n'),
      );

      const imported = importRawText(clean);
      if (imported) {
        toast.success('Generated table with AI', { id: 'ai-table-gen' });
        setAiPrompt('');
        clearUploadedImage();
        setTab('table');
      } else {
        setPastedText(clean);
        if (importPastedData()) {
          toast.success('Generated table with AI', { id: 'ai-table-gen' });
          setAiPrompt('');
          clearUploadedImage();
          setTab('table');
        }
      }
    } catch (err: unknown) {
      toast.error(
        (err as Error)?.message || 'Failed to generate table with AI',
        { id: 'ai-table-gen' },
      );
    } finally {
      setIsAiGenerating(false);
    }
  }, [
    aiPrompt,
    uploadedImage,
    isAiGenerating,
    importRawText,
    importPastedData,
    setPastedText,
    clearUploadedImage,
    setTab,
  ]);

  const renderRowCells = (
    rowIdx: number,
    values: string[],
    isHeader: boolean,
  ) => {
    const cells: React.ReactNode[] = [];
    let c = 0;

    while (c < tableCols) {
      const colIdx = c;
      const merge = merges.find((m) => m.row === rowIdx && m.col === colIdx);
      const span = merge
        ? Math.max(1, Math.min(merge.colSpan, tableCols - colIdx))
        : 1;
      const align = tableAlignments[colIdx] || 'c';
      const isSelected = Boolean(
        validSelection &&
          validSelection.row === rowIdx &&
          !(colIdx + span - 1 < selStartCol || colIdx > selEndCol),
      );
      const alignClass =
        align === 'l'
          ? 'text-left'
          : align === 'r'
            ? 'text-right'
            : 'text-center';

      cells.push(
        <td
          key={`${rowIdx}-${colIdx}`}
          colSpan={span}
          className={cn(
            'p-1',
            borders.innerVertical && colIdx + span < tableCols && 'border-r border-border/80',
          )}
        >
          <Input
            value={values[colIdx] ?? ''}
            onMouseDown={(e) => handleCellPointerDown(e, rowIdx, colIdx)}
            onChange={(e) =>
              isHeader
                ? updateTableHeader(colIdx, e.target.value)
                : updateTableCell(rowIdx, colIdx, e.target.value)
            }
            aria-label={
              isHeader
                ? `Header ${colIdx + 1}`
                : `Row ${rowIdx + 1} Column ${colIdx + 1}`
            }
            className={cn(
              'h-7 text-xs rounded-sm border-border/80 bg-background focus-visible:ring-1 focus-visible:ring-ring',
              isHeader && 'font-semibold',
              alignClass,
              span > 1 && 'border-primary/40 bg-primary/5',
              isSelected && 'ring-1 ring-primary border-primary bg-primary/5',
            )}
          />
        </td>,
      );
      c += span;
    }

    return cells;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-5 gap-3 text-xs bg-background border border-border shadow-raised-200 rounded-md">
        <DialogHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Insert Table
              </DialogTitle>
              <DialogDescription className="text-12 text-muted-foreground mt-0.5">
                Build a table, import spreadsheet data, or generate one with AI.
              </DialogDescription>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) => setTab(v as TableWizardTab)}
              className="shrink-0 mr-8"
            >
              <TabsList className="h-7 bg-muted p-0.5 border border-border rounded-md">
                <TabsTrigger
                  value="table"
                  className="text-xs min-h-[26px] h-6 px-2.5 rounded-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <TableIcon className="size-3.5" />
                  <span>Table</span>
                </TabsTrigger>
                <TabsTrigger
                  value="import"
                  className="text-xs min-h-[26px] h-6 px-2.5 rounded-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="size-3.5" />
                  <span>Import</span>
                </TabsTrigger>
                {aiAssistEnabled && (
                  <TabsTrigger
                    value="ai"
                    className="text-xs min-h-[26px] h-6 px-2.5 rounded-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="size-3.5 text-ai" />
                    <span>Create with AI</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        {/* ── Tab 1: Table Editor ── */}
        {activeTab === 'table' && (
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
            {/* Compact Toolbar: Size, Merge/Unmerge, Borders */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/20 border border-border rounded-md">
              <div className="flex items-center gap-1.5">
                <span className="text-11 font-medium text-muted-foreground">Size:</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={tableRows}
                  onChange={(e) =>
                    setTableDimension(parseInt(e.target.value, 10) || 1, tableCols)
                  }
                  className="w-12 h-7 text-xs font-mono text-center bg-background"
                  aria-label="Rows"
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={tableCols}
                  onChange={(e) =>
                    setTableDimension(tableRows, parseInt(e.target.value, 10) || 1)
                  }
                  className="w-12 h-7 text-xs font-mono text-center bg-background"
                  aria-label="Columns"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTableRow()}
                  className="h-7 px-2 text-11 gap-1 cursor-pointer ml-1"
                >
                  <Plus className="size-3" />
                  <span>Row</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTableColumn()}
                  className="h-7 px-2 text-11 gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>Column</span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {isSingleMergedSelection && activeSelectedMerge && validSelection ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => unmergeCell(validSelection.row, activeSelectedMerge.col)}
                    className="h-7 px-2 text-11 gap-1 cursor-pointer"
                    title="Split merged cell back into columns"
                  >
                    <Split className="size-3" />
                    <span>Unmerge</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canMergeSelection}
                    onClick={() => {
                      if (validSelection && canMergeSelection) {
                        mergeCells(validSelection.row, selStartCol, selEndCol);
                        setSelection({
                          row: validSelection.row,
                          anchorCol: selStartCol,
                          focusCol: selEndCol,
                        });
                      }
                    }}
                    className="h-7 px-2 text-11 gap-1 cursor-pointer"
                    title="Shift+click across cells in the same row to merge"
                  >
                    <Merge className="size-3" />
                    <span>
                      {canMergeSelection
                        ? `Merge (${selEndCol - selStartCol + 1})`
                        : 'Merge'}
                    </span>
                  </Button>
                )}

                <div className="h-4 w-px bg-border mx-0.5" />

                <span className="text-11 text-muted-foreground">Borders:</span>
                <button
                  type="button"
                  onClick={applyBooktabsPreset}
                  className={cn(
                    'h-7 px-2 text-11 font-medium rounded-sm border transition-colors cursor-pointer',
                    isBooktabsActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-foreground hover:bg-muted',
                  )}
                >
                  Booktabs
                </button>
                {(
                  [
                    { key: 'outer', label: 'Outer' },
                    { key: 'innerHorizontal', label: 'Horizontal' },
                    { key: 'innerVertical', label: 'Vertical' },
                  ] as const
                ).map((item) => {
                  const active = borders[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleBorder(item.key)}
                      className={cn(
                        'h-7 px-2 text-11 font-medium rounded-sm border transition-colors cursor-pointer',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-foreground hover:bg-muted',
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Editable Grid */}
            <div className="border border-border rounded-md bg-background overflow-auto max-h-64 p-2">
              <table
                className={cn(
                  'w-full border-collapse text-xs',
                  borders.outer && 'border border-border',
                  isBooktabsActive && 'border-t-2 border-b-2 border-foreground/50',
                )}
              >
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="w-8 p-1 text-center font-mono text-10 text-muted-foreground select-none">
                      #
                    </th>
                    {Array.from({ length: tableCols }, (_, cIdx) => {
                      const curAlign = (tableAlignments[cIdx] || 'c').toUpperCase();
                      return (
                        <th key={`col-ctrl-${cIdx}`} className="p-1 min-w-[96px]">
                          <div className="flex items-center justify-between gap-1 px-1.5 py-0.5 bg-muted/40 rounded-sm border border-border/50">
                            <button
                              type="button"
                              onClick={() => toggleColumnAlignment(cIdx)}
                              className="px-1.5 py-0.5 text-10 font-mono font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-sm cursor-pointer transition-colors"
                              title={`Column ${cIdx + 1} alignment: [${curAlign}] (click to cycle)`}
                            >
                              [{curAlign}]
                            </button>
                            {tableCols > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTableColumn(cIdx)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer p-0.5 rounded-sm"
                                aria-label={`Remove Column ${cIdx + 1}`}
                                title="Remove column"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-8" />
                  </tr>

                  {hasHeaderRow && (
                    <tr
                      className={cn(
                        'bg-muted/25',
                        isBooktabsActive
                          ? 'border-b-2 border-foreground/40'
                          : borders.innerHorizontal
                            ? 'border-b border-border'
                            : 'border-b border-border/60',
                      )}
                    >
                      <td className="w-8 p-1 text-center font-mono text-10 text-muted-foreground select-none">
                        H
                      </td>
                      {renderRowCells(-1, tableHeaders, true)}
                      <td className="w-8" />
                    </tr>
                  )}
                </thead>

                <tbody>
                  {Array.from({ length: tableRows }, (_, rIdx) => (
                    <tr
                      key={`row-${rIdx}`}
                      className={cn(
                        'hover:bg-muted/10',
                        rIdx < tableRows - 1 &&
                          (borders.innerHorizontal
                            ? 'border-b border-border'
                            : 'border-b border-border/30'),
                      )}
                    >
                      <td className="w-8 p-1 text-center font-mono text-10 text-muted-foreground select-none">
                        {rIdx + 1}
                      </td>
                      {renderRowCells(rIdx, tableData[rIdx] || [], false)}
                      <td className="w-8 p-1 text-center">
                        {tableRows > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTableRow(rIdx)}
                            className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded-sm transition-colors"
                            aria-label={`Delete Row ${rIdx + 1}`}
                            title="Delete row"
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

            {/* Compact Caption & Label Row */}
            <div className="flex flex-wrap items-center gap-3 p-2.5 bg-muted/20 border border-border rounded-md">
              <div className="flex-1 min-w-[160px] flex items-center gap-2">
                <label
                  htmlFor="table-caption-input"
                  className="text-11 font-medium text-muted-foreground whitespace-nowrap"
                >
                  Caption
                </label>
                <Input
                  id="table-caption-input"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Optional caption"
                  className="h-7 text-xs bg-background"
                />
              </div>

              <div className="w-44 flex items-center gap-2">
                <label
                  htmlFor="table-label-input"
                  className="text-11 font-medium text-muted-foreground whitespace-nowrap"
                >
                  Label
                </label>
                <Input
                  id="table-label-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="tab:example"
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1.5 text-11 font-medium cursor-pointer">
                  <Checkbox
                    checked={hasHeaderRow}
                    onCheckedChange={(c) => setHasHeaderRow(Boolean(c))}
                  />
                  <span>Header row</span>
                </label>
                <label className="flex items-center gap-1.5 text-11 font-medium cursor-pointer">
                  <Checkbox
                    checked={centering}
                    onCheckedChange={(c) => setCentering(Boolean(c))}
                  />
                  <span>Center</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Import Excel / CSV / LaTeX ── */}
        {activeTab === 'import' && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Paste cells copied from Excel or Google Sheets, CSV data, or an existing{' '}
              <code className="font-mono text-foreground">{'\\begin{tabular}'}</code> block.
            </p>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              aria-label="Paste Excel, CSV, or LaTeX code"
              placeholder="Paste TSV, CSV, or \begin{tabular}...\end{tabular} snippet..."
              rows={8}
              className="w-full flex-1 min-h-[160px] p-3 text-xs font-mono rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!pastedText.trim()}
                onClick={() => {
                  if (importPastedData()) {
                    setTab('table');
                  }
                }}
                className="h-8 px-3 text-xs cursor-pointer"
              >
                Import to Grid
              </Button>
            </div>
          </div>
        )}

        {/* ── Tab 3: Create with AI ── */}
        {activeTab === 'ai' && aiAssistEnabled && (
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
            <div className="space-y-1.5">
              <label
                htmlFor="ai-table-prompt"
                className="text-11 font-medium text-foreground block"
              >
                Describe the table
              </label>
              <textarea
                id="ai-table-prompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerateAiTable();
                  }
                }}
                placeholder="Describe columns, rows, or paste unformatted text (Ctrl+Enter to generate)..."
                rows={4}
                className="w-full p-2.5 text-xs rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-ai focus:border-ai/40"
              />
            </div>

            {/* Image Upload / Drag-and-Drop Zone */}
            <div className="space-y-1.5">
              <span className="text-11 font-medium text-foreground block">
                Table image (optional)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageSelected(e.target.files?.[0])}
              />
              {uploadedImage ? (
                <div className="flex items-center justify-between gap-3 p-2.5 border border-border rounded-md bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={uploadedImage.previewUrl}
                      alt={uploadedImage.file.name}
                      className="size-12 rounded-sm object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {uploadedImage.file.name}
                      </p>
                      <p className="text-11 text-muted-foreground">
                        {Math.max(1, Math.round(uploadedImage.file.size / 1024))} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearUploadedImage}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                    aria-label="Remove uploaded image"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    handleImageSelected(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-1.5 p-4 rounded-md border border-dashed transition-colors cursor-pointer text-center',
                    isDragOver
                      ? 'border-ai bg-ai/10'
                      : 'border-border bg-muted/15 hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Upload className="size-4" />
                    <ImageIcon className="size-4" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    Drop a screenshot of a table or click to upload
                  </span>
                  <span className="text-11 text-muted-foreground">
                    PNG, JPG, WebP
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateAiTable}
                disabled={isAiGenerating || (!aiPrompt.trim() && !uploadedImage)}
                className="h-8 px-3 text-xs bg-ai text-ai-foreground hover:bg-ai-hover font-medium cursor-pointer gap-1.5 shadow-none"
              >
                {isAiGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                <span>{isAiGenerating ? 'Generating...' : 'Generate Table'}</span>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={insertSnippet}
            className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Insert Table</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TableWizardModal;
