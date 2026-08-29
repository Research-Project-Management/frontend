'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput, Copy, Trash2, X, Folder, Library, Quote, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { convertToBibTeX, generateCitationKey } from '../../utils/library.util';
import type { Collection, Paper } from '../../types/library.types';

interface PaperBatchBarProps {
  selectedCount: number;
  selectedPapers: Paper[];
  collections: Collection[];
  onClearSelection: () => void;
  onBatchMove: (collectionId: string | null) => void;
  onBatchDelete: () => void;
}

export default function PaperBatchBar({
  selectedCount,
  selectedPapers,
  collections,
  onClearSelection,
  onBatchMove,
  onBatchDelete,
}: PaperBatchBarProps) {
  React.useEffect(() => {
    if (selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, onClearSelection]);

  if (selectedCount === 0) return null;

  const handleCopyMultiCite = () => {
    const keys = selectedPapers.map((p) => generateCitationKey(p)).filter(Boolean);
    const citeCmd = `\\cite{${keys.join(', ')}}`;
    navigator.clipboard.writeText(citeCmd);
    toast.success(`Copied ${citeCmd} to clipboard`);
  };

  const handleExportAllBibtex = () => {
    const bibtexEntries = selectedPapers.map((p) => convertToBibTeX(p)).join('\n\n');
    navigator.clipboard.writeText(bibtexEntries);
    toast.success(`Copied BibTeX for ${selectedCount} papers to clipboard`);
  };

  const handleDownloadBibFile = () => {
    const bibtexEntries = selectedPapers.map((p) => convertToBibTeX(p)).join('\n\n');
    const blob = new Blob([bibtexEntries], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `references-selected-${selectedCount}.bib`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded references.bib file`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-background/95 backdrop-blur-md border border-border rounded-full shadow-lg select-none ring-1 ring-border/40"
      >
        {/* Count Badge & Label */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-border/60">
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background text-xs font-mono font-bold tabular-nums">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            {selectedCount === 1 ? '1 selected' : `${selectedCount} selected`}
          </span>
        </div>

        {/* Move To Collection Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors shadow-none"
            >
              <FolderInput className="size-3.5 text-muted-foreground" />
              <span>Move to</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            sideOffset={8}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-56 p-1 text-xs rounded-xl shadow-xl"
          >
            <DropdownMenuItem
              onClick={() => onBatchMove(null)}
              className="gap-2 text-xs cursor-pointer rounded-lg"
            >
              <Library className="size-3.5 text-muted-foreground" />
              <span>My Library (Root)</span>
            </DropdownMenuItem>
            {collections.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => onBatchMove(c.id)}
                className="gap-2 text-xs cursor-pointer rounded-lg"
              >
                <Folder className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{c.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copy Multi Citation */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyMultiCite}
          className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors shadow-none inline-flex items-center"
          title="Copy citation for all selected"
        >
          <Quote className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Copy citation</span>
        </Button>

        {/* Copy All BibTeX */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportAllBibtex}
          className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors shadow-none inline-flex items-center"
          title="Copy BibTeX for all selected papers"
        >
          <Copy className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Copy BibTeX</span>
        </Button>

        {/* Download .bib */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadBibFile}
          className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors shadow-none inline-flex items-center"
          title="Download .bib file"
        >
          <Download className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Download .bib</span>
        </Button>

        {/* Batch Delete */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBatchDelete}
          className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-full cursor-pointer transition-colors shadow-none inline-flex items-center"
          title="Delete selected papers"
        >
          <Trash2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Delete</span>
        </Button>

        {/* Dismiss selection */}
        <button
          onClick={onClearSelection}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-0.5"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
