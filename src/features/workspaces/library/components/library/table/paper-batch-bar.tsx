'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput, Copy, Trash2, X, Folder, Library } from 'lucide-react';
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
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 bg-popover/95 backdrop-blur-lg border border-border/80 rounded-full shadow-2xl select-none"
      >
        <div className="flex items-center gap-2 pr-2.5 border-r border-border/60">
          <span className="flex size-5.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold font-mono">
            {selectedCount}
          </span>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            {selectedCount === 1 ? '1 selected' : `${selectedCount} selected`}
          </span>
        </div>

        {/* Move To Collection Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7.5 gap-1.5 text-xs text-foreground hover:bg-muted rounded-full cursor-pointer">
              <FolderInput className="size-3.5 text-foreground" />
              <span>Move to</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            sideOffset={8}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-56 p-1.5 text-xs rounded-xl shadow-xl"
          >
            <DropdownMenuItem onClick={() => onBatchMove(null)} className="gap-2 text-xs cursor-pointer">
              <Library className="size-4 text-foreground" />
              <span>My Library (Root)</span>
            </DropdownMenuItem>
            {collections.map((c) => (
              <DropdownMenuItem key={c._id} onClick={() => onBatchMove(c._id)} className="gap-2 text-xs cursor-pointer">
                <Folder className="size-4 text-foreground shrink-0" />
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
          className="h-7.5 gap-1.5 text-xs text-foreground hover:bg-muted rounded-full cursor-pointer"
          title="Export BibTeX for all selected papers"
        >
          <Copy className="size-3.5 text-foreground" />
          <span>Export BibTeX</span>
        </Button>

        {/* Batch Delete */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBatchDelete}
          className="h-7.5 gap-1.5 text-xs text-foreground hover:bg-muted rounded-full cursor-pointer"
        >
          <Trash2 className="size-3.5 text-foreground" />
          <span>Delete</span>
        </Button>

        {/* Dismiss selection */}
        <button
          onClick={onClearSelection}
          className="flex size-6 items-center justify-center rounded-full text-foreground hover:bg-muted ml-0.5 transition-colors cursor-pointer"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="size-3.5 text-foreground" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
