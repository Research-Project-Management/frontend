'use client';

/**
 * TableWizardModal.tsx
 *
 * Canonical Presentational Modal for LaTeX table insertion (Block 7: UI Shell / Modals Layer):
 * - State and validation managed by `useTableWizard` (React Hook Form + Zod)
 * - Toasts and clipboard operations encapsulated within the hook
 * - Zero direct toast imports in this presentation component
 * Location: `features/editor/ui/modals/TableWizardModal.tsx`
 */

import React from 'react';
import {
  Table as TableIcon,
  Check,
  Copy,
  Grid3X3,
  FileSpreadsheet,
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
import { cn } from '@/shared/lib/utils';
import { useTableWizard } from './hooks/useTableWizard';

export interface TableWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexCode: string) => void;
}

export function TableWizardModal({
  open,
  onOpenChange,
  onInsert,
}: TableWizardModalProps) {
  const {
    activeTab,
    setActiveTab,
    rows,
    setRows,
    cols,
    setCols,
    hoverRows,
    setHoverRows,
    hoverCols,
    setHoverCols,
    pastedText,
    setPastedText,
    parsedData,
    form,
    values,
    setValue,
    generatedLatex,
    insertTable,
    copyTableCode,
  } = useTableWizard({
    onInsert,
    onClose: () => onOpenChange(false),
  });

  const { register } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-6 gap-4 text-xs bg-background border border-border shadow-raised-300 rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TableIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Insert LaTeX Table
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Build a clean tabular layout or paste data directly from Excel and Google Sheets.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'visual' | 'paste')}
          className="w-full flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid grid-cols-2 w-full h-8 rounded-md bg-muted p-0.5 border border-border">
            <TabsTrigger value="visual" className="text-xs rounded-sm flex items-center gap-1.5 cursor-pointer">
              <Grid3X3 className="size-3.5" />
              Visual Grid Builder
            </TabsTrigger>
            <TabsTrigger value="paste" className="text-xs rounded-sm flex items-center gap-1.5 cursor-pointer">
              <FileSpreadsheet className="size-3.5" />
              Paste Excel / CSV
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Visual Grid */}
          <TabsContent value="visual" className="mt-3 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-muted/20 rounded-md border border-border">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground">
                  Dimension:{' '}
                  <span className="text-primary font-mono font-semibold">
                    {hoverRows || rows} rows × {hoverCols || cols} columns
                  </span>
                </span>
                <p className="text-11 text-muted-foreground">
                  Hover and click to choose dimensions, or use the inputs below.
                </p>
              </div>

              {/* 8x8 Hover Grid */}
              <div
                className="grid grid-cols-8 gap-1 p-1.5 bg-background rounded-md border border-border shrink-0 select-none"
                onMouseLeave={() => {
                  setHoverRows(0);
                  setHoverCols(0);
                }}
              >
                {Array.from({ length: 8 }).map((_, rIdx) =>
                  Array.from({ length: 8 }).map((_, cIdx) => {
                    const isSelected =
                      rIdx < (hoverRows || rows) && cIdx < (hoverCols || cols);
                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className={cn(
                          'size-4 rounded-xs border transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'bg-muted/60 border-border/80 hover:border-primary/60',
                        )}
                        onMouseEnter={() => {
                          setHoverRows(rIdx + 1);
                          setHoverCols(cIdx + 1);
                        }}
                        onClick={() => {
                          setRows(rIdx + 1);
                          setCols(cIdx + 1);
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Direct Row/Col Number Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-11 font-medium text-muted-foreground mb-1 block">
                  Rows
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-xs font-mono rounded-md border-border bg-background"
                />
              </div>
              <div>
                <label className="text-11 font-medium text-muted-foreground mb-1 block">
                  Columns
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-xs font-mono rounded-md border-border bg-background"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Paste Excel / CSV */}
          <TabsContent value="paste" className="mt-3 space-y-3 overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 flex items-center justify-between">
                <span>Paste Table Data</span>
                <span className="text-11 text-muted-foreground font-normal">
                  Tab-separated (Excel) or CSV
                </span>
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'First Name\tLast Name\tScore\nAlice\tSmith\t95\nBob\tJohnson\t88'}
                rows={5}
                className="w-full p-2.5 rounded-md border border-border bg-background text-xs font-mono resize-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="header-row"
                checked={values.firstRowIsHeader}
                onCheckedChange={(checked) => setValue('firstRowIsHeader', Boolean(checked))}
              />
              <label
                htmlFor="header-row"
                className="text-xs font-medium text-foreground cursor-pointer"
              >
                First row is column header (formats with \midrule or \hline)
              </label>
            </div>

            {/* Parsed Preview Table */}
            {parsedData.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/60 text-11 font-semibold text-muted-foreground border-b border-border flex items-center justify-between">
                  <span>Parsed Preview ({parsedData.length} rows)</span>
                  <span className="font-mono text-10">
                    {Math.max(...parsedData.map((r) => r.length))} columns
                  </span>
                </div>
                <div className="max-h-36 overflow-auto">
                  <table className="w-full text-xs text-left">
                    <tbody>
                      {parsedData.map((r, rIdx) => (
                        <tr
                          key={rIdx}
                          className={cn(
                            'border-b border-border/50 last:border-none',
                            rIdx === 0 && values.firstRowIsHeader
                              ? 'bg-muted/40 font-semibold'
                              : 'hover:bg-muted/20',
                          )}
                        >
                          {r.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 truncate max-w-[150px]">
                              {cell || <span className="text-muted-foreground/40 italic">empty</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Global Options: Style, Alignment, Caption, Label */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Style Selector */}
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Table Style
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'booktabs', label: 'Booktabs' },
                  { id: 'bordered', label: 'Bordered' },
                  { id: 'minimal', label: 'Minimal' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setValue('tableStyle', s.id as any)}
                    className={cn(
                      'h-7 px-2 text-11 font-medium rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      values.tableStyle === s.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alignment Selector */}
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Column Alignment
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'l', label: 'Left' },
                  { id: 'c', label: 'Center' },
                  { id: 'r', label: 'Right' },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setValue('defaultAlign', a.id as any)}
                    className={cn(
                      'h-7 px-2 text-11 font-medium rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      values.defaultAlign === a.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Caption & Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Caption
              </label>
              <Input
                {...register('caption')}
                placeholder="Table caption description"
                className="h-8 text-xs rounded-md border-border bg-background"
              />
            </div>
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Label (for \ref)
              </label>
              <Input
                {...register('label')}
                placeholder="tab:results"
                className="h-8 text-xs font-mono rounded-md border-border bg-background"
              />
            </div>
          </div>

          {/* Placement & Centering */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-11 font-medium text-muted-foreground">
                Placement:
              </label>
              <div className="flex items-center gap-1">
                {['htbp', '!ht', 't', 'b', 'h'].map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setValue('placement', spec)}
                    className={cn(
                      'px-2 py-0.5 text-11 font-mono rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      values.placement === spec
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted',
                    )}
                  >
                    [{spec}]
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="table-centering"
                checked={values.centering}
                onCheckedChange={(c) => setValue('centering', Boolean(c))}
              />
              <label
                htmlFor="table-centering"
                className="text-xs font-medium text-foreground cursor-pointer"
              >
                Center table (\centering)
              </label>
            </div>
          </div>
        </div>

        {/* Live Code Preview */}
        <div className="border border-border rounded-md bg-muted/10 p-2.5 font-mono text-11 max-h-24 overflow-y-auto select-all">
          <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
            {generatedLatex}
          </pre>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyTableCode}
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
              onClick={insertTable}
              className="gap-1.5 h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Check className="size-3.5" />
              Insert Table
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TableWizardModal;
