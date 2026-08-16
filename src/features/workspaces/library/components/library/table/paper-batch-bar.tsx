'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput, Copy, Trash2, X, FileJson, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui';
import type { Collection, Paper } from '../../../types/library.types';

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
  if (selectedCount === 0) return null;

  const handleExportAllBibtex = () => {
    const bibtexEntries = selectedPapers.map((p, i) => {
      const citeKey = p.citationKey || (p.authors?.[0] ? `${p.authors[0].toLowerCase().split(' ').pop()}${p.year || '2024'}` : `ref${i + 1}`);
      return `@article{${citeKey},
  title = {${p.title || ''}},
  author = {${p.authors?.join(' and ') || ''}},
  journal = {${p.journal || p.publisher || ''}},
  year = {${p.year || ''}},
  doi = {${p.doi || ''}}
}`;
    }).join('\n\n');

    navigator.clipboard.writeText(bibtexEntries);
    toast.success(`Copied BibTeX for ${selectedCount} papers to clipboard`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 bg-popover/95 backdrop-blur-md border border-border/70 rounded-lg shadow-2xl select-none"
      >
        <div className="flex items-center gap-2 pr-2 border-r border-border/60">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold font-mono">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            {selectedCount === 1 ? '1 paper selected' : `${selectedCount} papers selected`}
          </span>
        </div>

        {/* Move To Collection Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted cursor-pointer">
              <FolderInput className="size-3.5 text-foreground" />
              Move to
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-56 p-1 text-xs"
          >
            <DropdownMenuItem onClick={() => onBatchMove(null)} className="text-xs cursor-pointer">
              My Library (Root)
            </DropdownMenuItem>
            {collections.map((c) => (
              <DropdownMenuItem key={c._id} onClick={() => onBatchMove(c._id)} className="text-xs cursor-pointer">
                <span className="truncate">{c.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copy All BibTeX */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportAllBibtex}
          className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted cursor-pointer"
          title="Copy BibTeX citations"
        >
          <Copy className="size-3.5 text-foreground" />
          Export BibTeX
        </Button>

        {/* Batch Delete */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBatchDelete}
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
        >
          <Trash2 className="size-3.5 text-destructive" />
          Delete
        </Button>

        {/* Dismiss selection */}
        <button
          onClick={onClearSelection}
          className="flex size-6 items-center justify-center rounded-md text-foreground hover:bg-muted ml-1 transition-colors cursor-pointer"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="size-3.5 text-foreground" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
