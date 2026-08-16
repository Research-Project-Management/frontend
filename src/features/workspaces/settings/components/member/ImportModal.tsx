'use client';

import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@/shared/components/ui';
import type { WorkspaceRole } from '../../types/member.types';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: { email: string; role: WorkspaceRole }[]) => Promise<void>;
  isImporting?: boolean;
}

export function ImportModal({
  open,
  onOpenChange,
  onImport,
  isImporting,
}: ImportModalProps) {
  const [parsedRows, setParsedRows] = useState<{ email: string; role: WorkspaceRole }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const rows: { email: string; role: WorkspaceRole }[] = [];

      // Parse lines (skip header if contains 'email')
      for (const line of lines) {
        if (line.toLowerCase().includes('email')) continue;
        const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
        const email = parts[0];
        const role = (parts[1]?.toLowerCase() as WorkspaceRole) || 'member';
        if (email && email.includes('@')) {
          rows.push({ email, role: ['admin', 'member', 'guest'].includes(role) ? role : 'member' });
        }
      }

      setParsedRows(rows);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template = 'Email,Role\ncolleague1@example.com,member\ncolleague2@example.com,admin\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workspace-members-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    await onImport(parsedRows);
    setParsedRows([]);
    setFileName(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-lg border border-border/80 bg-background shadow-2xl space-y-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold text-foreground">
            Import members from CSV
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload a CSV file with columns: <span className="font-mono text-foreground">Email, Role</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Dropzone */}
        <label
          htmlFor="csv-import-file"
          className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/80 hover:border-primary/60 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer min-h-[130px]"
        >
          {fileName ? (
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <FileSpreadsheet className="size-5 text-emerald-500" />
              <span>{fileName} ({parsedRows.length} members detected)</span>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <Upload className="size-6 text-muted-foreground mx-auto mb-1 stroke-[1.5]" />
              <p className="text-xs font-medium text-foreground">
                Drag & drop or browse CSV file
              </p>
              <p className="text-[11px] text-muted-foreground">
                Supported format: .csv
              </p>
            </div>
          )}

          <input
            id="csv-import-file"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
            disabled={isImporting}
          />
        </label>

        {/* Download Template button */}
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-primary hover:underline text-xs flex items-center gap-1 cursor-pointer font-medium"
          >
            <Download className="size-3.5" />
            <span>Download CSV template</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setParsedRows([]);
              setFileName(null);
              onOpenChange(false);
            }}
            className="h-8 px-3.5 text-xs font-medium rounded-lg cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleImportSubmit}
            disabled={isImporting || parsedRows.length === 0}
            className="h-8 px-4 text-xs font-medium bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {isImporting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Import {parsedRows.length > 0 ? `(${parsedRows.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
