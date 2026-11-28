'use client';

/**
 * TableImportTab.tsx
 *
 * Tab panel for pasting Excel/TSV, CSV, or raw LaTeX tabular code into the table grid.
 */

import React from 'react';
import { Button } from '@/shared/components/ui/button';

export interface TableImportTabProps {
  importText: string;
  onChangeText: (value: string) => void;
  onImport: () => void;
}

export function TableImportTab({
  importText,
  onChangeText,
  onImport,
}: TableImportTabProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Paste cells copied from Excel or Google Sheets, CSV data, or an existing{' '}
        <code className="font-mono text-foreground">{'\\begin{tabular}'}</code> block.
      </p>
      <textarea
        value={importText}
        onChange={(e) => onChangeText(e.target.value)}
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
          disabled={!importText.trim()}
          onClick={onImport}
          className="h-8 px-3 text-xs cursor-pointer"
        >
          Import to Grid
        </Button>
      </div>
    </div>
  );
}
