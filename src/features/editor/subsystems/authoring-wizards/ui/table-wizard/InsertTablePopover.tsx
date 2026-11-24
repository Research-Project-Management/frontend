'use client';

/**
 * InsertTablePopover.tsx
 *
 * Overleaf-style quick table insertion popover for the editor toolbar:
 * - Interactive 8x8 hover grid ("Select size") for instant blank table insertion
 * - Quick entry to Table Wizard modal ("Custom table") and AI Table Generator
 */

import React, { useState } from 'react';
import { Table as TableIcon, Table2, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { editorCommandBus } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { generateLatexTable } from '@/features/editor/domain/latex/table-matrix';

const MAX_GRID_DIM = 8;

export interface InsertTablePopoverProps {
  disabled?: boolean;
  triggerClassName?: string;
}

export function InsertTablePopover({
  disabled = false,
  triggerClassName,
}: InsertTablePopoverProps) {
  const [open, setOpen] = useState(false);
  const [hoverDims, setHoverDims] = useState<{ rows: number; cols: number }>({
    rows: 0,
    cols: 0,
  });
  const aiAssistEnabled = useSettingsStore((s) => s.aiAssistEnabled);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setHoverDims({ rows: 0, cols: 0 });
    }
  };

  const handleSelectSize = (rows: number, cols: number) => {
    const hasHeader = rows >= 2;
    const dataRows = hasHeader ? rows - 1 : rows;

    const latex = generateLatexTable({
      rows: dataRows,
      cols,
      headers: Array(cols).fill(''),
      data: Array.from({ length: dataRows }, () => Array(cols).fill('')),
      alignments: Array(cols).fill('c'),
      style: 'booktabs',
      centering: true,
      hasHeaderRow: hasHeader,
      caption: '',
      label: '',
    });

    editorCommandBus.dispatch({ type: 'editor:insert-text', text: latex });
    editorCommandBus.dispatch({ type: 'editor:focus' });
    setOpen(false);
  };

  const handleOpenWizard = (initialTab: 'table' | 'ai') => {
    setOpen(false);
    editorCommandBus.dispatch({
      type: 'dialog:open',
      dialog: 'table-wizard',
      payload: { initialTab },
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={triggerClassName}
              aria-label="Insert table"
            >
              <TableIcon className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          <span>Table</span>
          <span className="ml-1.5 opacity-60">Ctrl+Shift+T</span>
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-56 p-2.5 text-xs select-none">
        <div className="flex items-center justify-between mb-2">
          <span className="text-11 font-medium text-muted-foreground">
            Select size
          </span>
          <span className="text-11 font-mono font-semibold text-foreground tabular-nums">
            {hoverDims.rows > 0 ? `${hoverDims.rows} × ${hoverDims.cols}` : '—'}
          </span>
        </div>

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${MAX_GRID_DIM}, minmax(0, 1fr))` }}
          onMouseLeave={() => setHoverDims({ rows: 0, cols: 0 })}
        >
          {Array.from({ length: MAX_GRID_DIM }, (_, rIdx) =>
            Array.from({ length: MAX_GRID_DIM }, (_, cIdx) => {
              const r = rIdx + 1;
              const c = cIdx + 1;
              const active = r <= hoverDims.rows && c <= hoverDims.cols;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  aria-label={`Insert ${r} by ${c} table`}
                  onMouseEnter={() => setHoverDims({ rows: r, cols: c })}
                  onFocus={() => setHoverDims({ rows: r, cols: c })}
                  onClick={() => handleSelectSize(r, c)}
                  className={cn(
                    'aspect-square w-full rounded-[2px] border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    active
                      ? 'bg-primary/20 border-primary'
                      : 'bg-background border-border hover:border-primary/60'
                  )}
                />
              );
            })
          )}
        </div>

        <div className="border-t border-border mt-2.5 pt-1.5 space-y-0.5">
          <button
            type="button"
            onClick={() => handleOpenWizard('table')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
          >
            <Table2 className="size-3.5 text-muted-foreground shrink-0" />
            <span>Custom table</span>
          </button>
          {aiAssistEnabled && (
            <button
              type="button"
              onClick={() => handleOpenWizard('ai')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
            >
              <Sparkles className="size-3.5 text-muted-foreground shrink-0" />
              <span>Create with AI</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
