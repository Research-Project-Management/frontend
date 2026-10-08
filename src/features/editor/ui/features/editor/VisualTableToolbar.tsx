'use client';

/**
 * VisualTableToolbar.tsx
 *
 * Floating Matrix & Cell Toolbar for Visual LaTeX Editor Mode (Overleaf Parity).
 * Location: `features/editor/ui/features/editor/VisualTableToolbar.tsx`
 *
 * Provides instant WYSIWYG table matrix operations:
 * - Row operations: Insert Above, Insert Below, Delete Row
 * - Column operations: Insert Left, Insert Right, Delete Column
 * - Alignment controls: Left, Center, Right (synced with LaTeX tabular spec l/c/r)
 * - Metadata popover: Edit Caption and Label (\caption{...}, \label{...})
 * - Delete entire Table with single click
 */

import React, { useState } from 'react';
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Settings2,
  Table as TableIcon,
  X,
  Check,
  Tag,
  FileText,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

export interface VisualTableToolbarProps {
  position: { top: number; left: number };
  caption?: string;
  label?: string;
  columnAlignment?: 'left' | 'center' | 'right';
  rowIndex?: number;
  colIndex?: number;
  totalRows?: number;
  totalCols?: number;
  onAddRowAbove: () => void;
  onAddRowBelow: () => void;
  onDeleteRow: () => void;
  onAddColumnLeft: () => void;
  onAddColumnRight: () => void;
  onDeleteColumn: () => void;
  onAlignColumn: (align: 'left' | 'center' | 'right') => void;
  onUpdateMetadata: (caption: string, label: string) => void;
  onDeleteTable: () => void;
  onClose: () => void;
}

export function VisualTableToolbar({
  position,
  caption = '',
  label = '',
  columnAlignment = 'center',
  rowIndex = 0,
  colIndex = 0,
  totalRows,
  totalCols,
  onAddRowAbove,
  onAddRowBelow,
  onDeleteRow,
  onAddColumnLeft,
  onAddColumnRight,
  onDeleteColumn,
  onAlignColumn,
  onUpdateMetadata,
  onDeleteTable,
  onClose,
}: VisualTableToolbarProps) {
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [captionInput, setCaptionInput] = useState(caption);
  const [labelInput, setLabelInput] = useState(label);

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMetadata(captionInput.trim(), labelInput.trim());
    setIsEditingMeta(false);
  };

  return (
    <div
      role="toolbar"
      aria-label="Table Matrix Toolbar"
      className={cn(
        'fixed z-50 flex flex-col items-start bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl p-1.5 transition-all text-xs text-foreground select-none',
        'animate-in fade-in zoom-in-95 duration-150'
      )}
      style={{
        top: `${Math.max(10, position.top)}px`,
        left: `${Math.max(10, position.left)}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Main Action Bar ── */}
      <div className="flex items-center gap-1 w-full">
        {/* Table & Matrix Position Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-lg text-muted-foreground mr-1 text-[11px] font-mono font-medium">
          <TableIcon className="size-3.5 text-primary" />
          <span>
            R{rowIndex + 1}
            {totalRows ? `/${totalRows}` : ''} : C{colIndex + 1}
            {totalCols ? `/${totalCols}` : ''}
          </span>
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Row Operations */}
        <div className="flex items-center gap-0.5" title="Row Operations">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted text-foreground/80 hover:text-foreground cursor-pointer"
            onClick={onAddRowAbove}
            title="Add Row Above"
            aria-label="Add row above"
          >
            <ArrowUpToLine className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted text-foreground/80 hover:text-foreground cursor-pointer"
            onClick={onAddRowBelow}
            title="Add Row Below"
            aria-label="Add row below"
          >
            <ArrowDownToLine className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={onDeleteRow}
            title="Delete Current Row"
            aria-label="Delete row"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Column Operations */}
        <div className="flex items-center gap-0.5" title="Column Operations">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted text-foreground/80 hover:text-foreground cursor-pointer"
            onClick={onAddColumnLeft}
            title="Add Column Left"
            aria-label="Add column left"
          >
            <ArrowLeftToLine className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted text-foreground/80 hover:text-foreground cursor-pointer"
            onClick={onAddColumnRight}
            title="Add Column Right"
            aria-label="Add column right"
          >
            <ArrowRightToLine className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={onDeleteColumn}
            title="Delete Current Column"
            aria-label="Delete column"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Alignment Controls */}
        <div className="flex items-center gap-0.5" title="Column Alignment">
          <Button
            type="button"
            variant={columnAlignment === 'left' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'size-7 cursor-pointer',
              columnAlignment === 'left'
                ? 'bg-primary/15 text-primary font-bold hover:bg-primary/20'
                : 'hover:bg-muted text-foreground/80 hover:text-foreground'
            )}
            onClick={() => onAlignColumn('left')}
            title="Align Left (l)"
            aria-label="Align column left"
          >
            <AlignLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant={columnAlignment === 'center' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'size-7 cursor-pointer',
              columnAlignment === 'center'
                ? 'bg-primary/15 text-primary font-bold hover:bg-primary/20'
                : 'hover:bg-muted text-foreground/80 hover:text-foreground'
            )}
            onClick={() => onAlignColumn('center')}
            title="Align Center (c)"
            aria-label="Align column center"
          >
            <AlignCenter className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant={columnAlignment === 'right' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'size-7 cursor-pointer',
              columnAlignment === 'right'
                ? 'bg-primary/15 text-primary font-bold hover:bg-primary/20'
                : 'hover:bg-muted text-foreground/80 hover:text-foreground'
            )}
            onClick={() => onAlignColumn('right')}
            title="Align Right (r)"
            aria-label="Align column right"
          >
            <AlignRight className="size-3.5" />
          </Button>
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Metadata Settings Toggle */}
        <Button
          type="button"
          variant={isEditingMeta ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2 gap-1 text-[11px] font-medium cursor-pointer',
            isEditingMeta
              ? 'bg-primary/15 text-primary hover:bg-primary/20'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
          onClick={() => {
            setCaptionInput(caption);
            setLabelInput(label);
            setIsEditingMeta((prev) => !prev);
          }}
          title="Edit Caption & Label"
          aria-label="Toggle caption and label editor"
        >
          <Settings2 className="size-3.5" />
          <span className="hidden sm:inline">Caption/Label</span>
        </Button>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Delete Table Action */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 hover:bg-destructive/15 text-destructive cursor-pointer"
          onClick={onDeleteTable}
          title="Delete Entire Table"
          aria-label="Delete table"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>

        {/* Close Toolbar */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer ml-1"
          onClick={onClose}
          title="Close Toolbar"
          aria-label="Close table toolbar"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* ── Expandable Caption & Label Editor Card ── */}
      {isEditingMeta && (
        <form
          onSubmit={handleSaveMeta}
          className="w-full mt-2 pt-2 border-t border-border/60 flex flex-col gap-2 p-1 bg-muted/20 rounded-lg animate-in fade-in duration-100"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label
                htmlFor="visual-table-caption-input"
                className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"
              >
                <FileText className="size-3 text-primary" />
                <span>Caption (\caption&#123;...&#125;):</span>
              </label>
              <Input
                id="visual-table-caption-input"
                aria-label="Table caption input"
                placeholder="e.g. Model Performance Comparison"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                className="h-7 text-xs font-sans"
                autoFocus
              />
            </div>
            <div className="w-1/3 space-y-1">
              <label
                htmlFor="visual-table-label-input"
                className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"
              >
                <Tag className="size-3 text-primary" />
                <span>Label (\label&#123;...&#125;):</span>
              </label>
              <Input
                id="visual-table-label-input"
                aria-label="Table label input"
                placeholder="e.g. tab:perf"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="h-7 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setIsEditingMeta(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1 font-medium cursor-pointer"
            >
              <Check className="size-3" />
              <span>Apply Metadata</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default VisualTableToolbar;
