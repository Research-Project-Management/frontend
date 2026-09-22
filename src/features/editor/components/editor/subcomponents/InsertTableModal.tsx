'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Table as TableIcon, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface InsertTableModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (snippet: string) => void;
}

const MAX_GRID_ROWS = 8;
const MAX_GRID_COLS = 8;

export function InsertTableModal({
  open,
  onClose,
  onInsert,
}: InsertTableModalProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const [useBooktabs, setUseBooktabs] = useState(true);
  const [hasHeader, setHasHeader] = useState(true);
  const [alignment, setAlignment] = useState<'c' | 'l' | 'r'>('c');
  const [caption, setCaption] = useState('Table Caption');
  const [label, setLabel] = useState('tab:table1');

  const activeRows = hoverRows > 0 ? hoverRows : rows;
  const activeCols = hoverCols > 0 ? hoverCols : cols;

  const handleCellClick = (r: number, c: number) => {
    setRows(r);
    setCols(c);
    setHoverRows(0);
    setHoverCols(0);
  };

  const handleInsert = () => {
    const colAlignStr = alignment.repeat(cols);
    const headerCols = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`).join(' & ');
    
    let bodyRows = '';
    const numDataRows = hasHeader ? Math.max(1, rows - 1) : rows;
    for (let r = 0; r < numDataRows; r++) {
      const rowData = Array.from({ length: cols }, (_, c) => `Cell ${r + 1},${c + 1}`).join(' & ');
      bodyRows += `    ${rowData} \\\\\n`;
    }

    let snippet = '';
    if (useBooktabs) {
      snippet = `\\begin{table}[htbp]
  \\centering
  \\caption{${caption}}
  \\label{${label}}
  \\begin{tabular}{${colAlignStr}}
    \\toprule
${hasHeader ? `    ${headerCols} \\\\\n    \\midrule\n` : ''}${bodyRows}    \\bottomrule
  \\end{tabular}
\\end{table}`;
    } else {
      snippet = `\\begin{table}[htbp]
  \\centering
  \\caption{${caption}}
  \\label{${label}}
  \\begin{tabular}{|${Array.from({ length: cols }, () => alignment).join('|')}|}
    \\hline
${hasHeader ? `    ${headerCols} \\\\\n    \\hline\n` : ''}${bodyRows}    \\hline
  \\end{tabular}
\\end{table}`;
    }

    onInsert(snippet);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md p-6 bg-background rounded-lg border border-border shadow-raised-300">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <TableIcon className="size-4" />
            </div>
            <span>Insert LaTeX Table</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Grid visual picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Table Dimensions
              </Label>
              <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-sm">
                {activeRows} × {activeCols}
              </span>
            </div>

            <div
              className="grid gap-1 p-2.5 bg-muted/40 rounded-md border border-border w-fit mx-auto select-none"
              style={{
                gridTemplateColumns: `repeat(${MAX_GRID_COLS}, minmax(0, 1fr))`,
              }}
              onMouseLeave={() => {
                setHoverRows(0);
                setHoverCols(0);
              }}
            >
              {Array.from({ length: MAX_GRID_ROWS }).map((_, rIdx) =>
                Array.from({ length: MAX_GRID_COLS }).map((_, cIdx) => {
                  const r = rIdx + 1;
                  const c = cIdx + 1;
                  const isSelected = r <= activeRows && c <= activeCols;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      aria-label={`Select ${r} by ${c} table`}
                      className={cn(
                        'size-5 rounded-xs border transition-all duration-100 cursor-pointer',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground shadow-2xs'
                          : 'bg-background/80 border-border/80 hover:border-primary/50',
                      )}
                      onMouseEnter={() => {
                        setHoverRows(r);
                        setHoverCols(c);
                      }}
                      onClick={() => handleCellClick(r, c)}
                    />
                  );
                }),
              )}
            </div>
          </div>

          {/* Form settings */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="tab-caption" className="text-xs font-medium">
                Caption
              </Label>
              <Input
                id="tab-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Table description..."
                className="h-8 text-xs font-normal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tab-label" className="text-xs font-medium">
                Label (reference)
              </Label>
              <Input
                id="tab-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="tab:my_label"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Configuration checkboxes & alignment */}
          <div className="pt-2 border-t border-border space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Column Alignment:</span>
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border">
                {(['c', 'l', 'r'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAlignment(mode)}
                    className={cn(
                      'px-2.5 py-0.5 rounded-sm text-xs font-mono font-medium transition-colors cursor-pointer',
                      alignment === mode
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {mode === 'c' ? 'Center (c)' : mode === 'l' ? 'Left (l)' : 'Right (r)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-foreground select-none">
                <input
                  type="checkbox"
                  checked={useBooktabs}
                  onChange={(e) => setUseBooktabs(e.target.checked)}
                  className="rounded-xs border-border text-primary focus:ring-primary size-3.5"
                />
                <span>Use <code>booktabs</code> (\toprule, \midrule)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-foreground select-none">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                  className="rounded-xs border-border text-primary focus:ring-primary size-3.5"
                />
                <span>Header Row</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleInsert}
            className="h-8 text-xs font-medium gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Insert Table</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
