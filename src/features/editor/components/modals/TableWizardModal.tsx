'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Table as TableIcon,
  FileSpreadsheet,
  Grid3X3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Check,
  Copy,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface TableWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexCode: string) => void;
}

type TableStyle = 'booktabs' | 'bordered' | 'minimal';
type ColAlign = 'l' | 'c' | 'r';

export default function TableWizardModal({
  open,
  onOpenChange,
  onInsert,
}: TableWizardModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'paste'>('visual');

  // Visual builder state
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);
  const [hoverRows, setHoverRows] = useState<number>(0);
  const [hoverCols, setHoverCols] = useState<number>(0);

  // Table options
  const [tableStyle, setTableStyle] = useState<TableStyle>('booktabs');
  const [defaultAlign, setDefaultAlign] = useState<ColAlign>('c');
  const [caption, setCaption] = useState<string>('Summary of results');
  const [label, setLabel] = useState<string>('tab:results');
  const [placement, setPlacement] = useState<string>('htbp');
  const [centering, setCentering] = useState<boolean>(true);

  // Paste Excel/CSV state
  const [pastedText, setPastedText] = useState<string>('');
  const [firstRowIsHeader, setFirstRowIsHeader] = useState<boolean>(true);

  // Parse pasted Excel/CSV data
  const parsedData = useMemo(() => {
    if (!pastedText.trim()) return [];

    // Auto-detect delimiter: check for Tab first (Excel clipboard uses \t)
    const sampleLine = pastedText.split(/\r?\n/)[0] || '';
    let delimiter = '\t';
    if (!sampleLine.includes('\t')) {
      if (sampleLine.includes(',')) delimiter = ',';
      else if (sampleLine.includes(';')) delimiter = ';';
    }

    const lines = pastedText.trim().split(/\r?\n/);
    return lines.map((line) => {
      // Basic CSV splitting (handles quotes reasonably)
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
        return entries.filter((_, idx, arr) => idx < arr.length || valNotEmpty(arr));
      }
      return line.split(delimiter).map((c) => c.trim());
    });
  }, [pastedText]);

  function valNotEmpty(arr: string[]) {
    return arr.some((item) => item.length > 0);
  }

  // Generate LaTeX Code
  const generatedLatex = useMemo(() => {
    const isPaste = activeTab === 'paste' && parsedData.length > 0;
    const effCols = isPaste ? Math.max(...parsedData.map((r) => r.length), 1) : cols;
    const effRows = isPaste ? parsedData.length : rows;

    // Build column spec
    let colSpec = '';
    if (tableStyle === 'bordered') {
      colSpec = `|${Array(effCols).fill(defaultAlign).join('|')}|`;
    } else {
      colSpec = Array(effCols).fill(defaultAlign).join('');
    }

    let body = '';

    if (isPaste) {
      // Build from pasted data
      parsedData.forEach((row, rIdx) => {
        // Pad row to effCols
        const padded = [...row];
        while (padded.length < effCols) padded.push('');
        // Escape LaTeX special chars & , % , $
        const sanitized = padded.map((cell) =>
          cell.replace(/([%$#&_])/g, '\\$1')
        );

        if (rIdx === 0 && firstRowIsHeader) {
          body += `    ${sanitized.join(' & ')} \\\\\n`;
          if (tableStyle === 'booktabs') {
            body += `    \\midrule\n`;
          } else if (tableStyle === 'bordered') {
            body += `    \\hline\n`;
          }
        } else {
          body += `    ${sanitized.join(' & ')} \\\\\n`;
          if (tableStyle === 'bordered' && rIdx < effRows - 1) {
            body += `    \\hline\n`;
          }
        }
      });
    } else {
      // Build from grid
      for (let r = 0; r < effRows; r++) {
        const cells: string[] = [];
        for (let c = 0; c < effCols; c++) {
          if (r === 0) {
            cells.push(`Header ${c + 1}`);
          } else {
            cells.push(`Data ${r},${c + 1}`);
          }
        }
        body += `    ${cells.join(' & ')} \\\\\n`;
        if (r === 0) {
          if (tableStyle === 'booktabs') {
            body += `    \\midrule\n`;
          } else if (tableStyle === 'bordered') {
            body += `    \\hline\n`;
          }
        } else if (tableStyle === 'bordered' && r < effRows - 1) {
          body += `    \\hline\n`;
        }
      }
    }

    // Wrap in table environment
    let result = '';
    result += `\\begin{table}[${placement}]\n`;
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
    if (tableStyle === 'booktabs') {
      result += `    \\toprule\n`;
    } else if (tableStyle === 'bordered') {
      result += `    \\hline\n`;
    }

    result += body;

    if (tableStyle === 'booktabs') {
      result += `    \\bottomrule\n`;
    } else if (tableStyle === 'bordered') {
      result += `    \\hline\n`;
    }
    result += `  \\end{tabular}\n`;
    result += `\\end{table}\n`;

    return result;
  }, [
    activeTab,
    rows,
    cols,
    tableStyle,
    defaultAlign,
    caption,
    label,
    placement,
    centering,
    parsedData,
    firstRowIsHeader,
  ]);

  const handleInsert = () => {
    onInsert(generatedLatex);
    toast.success('Table inserted into document');
    onOpenChange(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedLatex);
    toast.info('LaTeX code copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 gap-4 text-xs bg-background border border-border shadow-raised-300 rounded-lg">
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
                  <span className="text-primary font-mono font-bold">
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
                            : 'bg-muted/60 border-border/80 hover:border-primary/60'
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
                className="w-full p-2.5 rounded-md border border-border bg-background text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="header-row"
                checked={firstRowIsHeader}
                onCheckedChange={(checked) => setFirstRowIsHeader(Boolean(checked))}
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
                            rIdx === 0 && firstRowIsHeader
                              ? 'bg-muted/40 font-semibold'
                              : 'hover:bg-muted/20'
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
                    onClick={() => setTableStyle(s.id as TableStyle)}
                    className={cn(
                      'h-7 px-2 text-11 font-medium rounded-sm border transition-colors cursor-pointer',
                      tableStyle === s.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted shadow-2xs'
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
                  { id: 'l', icon: AlignLeft, label: 'Left (l)' },
                  { id: 'c', icon: AlignCenter, label: 'Center (c)' },
                  { id: 'r', icon: AlignRight, label: 'Right (r)' },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setDefaultAlign(a.id as ColAlign)}
                      className={cn(
                        'h-7 px-2 text-11 font-medium rounded-sm border flex items-center justify-center gap-1 transition-colors cursor-pointer',
                        defaultAlign === a.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-foreground hover:bg-muted shadow-2xs'
                      )}
                    >
                      <Icon className="size-3" />
                      <span>{a.id}</span>
                    </button>
                  );
                })}
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
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Table caption"
                className="h-8 text-xs rounded-md border-border bg-background"
              />
            </div>
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Label (for \ref)
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="tab:my_table"
                className="h-8 text-xs font-mono rounded-md border-border bg-background"
              />
            </div>
          </div>
        </div>

        {/* Live Code Preview Accordion */}
        <div className="border border-border rounded-md bg-muted/10 p-2.5 font-mono text-11 max-h-28 overflow-y-auto select-all">
          <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
            {generatedLatex}
          </pre>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="gap-1.5 h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs"
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
              className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleInsert}
              className="gap-1.5 h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-2xs cursor-pointer"
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
