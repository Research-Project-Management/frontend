'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput, Copy, Trash2, X, Folder, Library, Quote, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { convertToBibTeX, generateCitationKey } from '../../utils/library.util';
import { CitationService } from '../../services/citation.service';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import type { Collection, CatalogItem, CslStyle } from '../../types/library.types';

export interface BatchBarProps {
  selectedCount: number;
  selectedItems?: CatalogItem[];
  /** @deprecated Use selectedItems */
  selectedPapers?: CatalogItem[];
  collections: Collection[];
  onClearSelection: () => void;
  onBatchMove?: (collectionId: string | null) => void;
  onBatchDelete?: () => void;
  onBatchRestore?: () => void;
  isTrash?: boolean;
}

export type PaperBatchBarProps = BatchBarProps;

export function BatchBar({
  selectedCount,
  selectedItems,
  selectedPapers,
  collections,
  onClearSelection,
  onBatchMove,
  onBatchDelete,
  onBatchRestore,
  isTrash = false,
}: BatchBarProps) {
  const copyWithToast = async (text: string, label: string = 'Copied to clipboard') => {
    if (!text || !text.trim()) {
      toast.error('Nothing to copy', { id: 'library-clipboard' });
      return;
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success(label, { id: 'library-clipboard' });
    } else {
      toast.error('Failed to copy to clipboard', { id: 'library-clipboard' });
    }
  };

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

  // Support both selectedItems and deprecated selectedPapers prop
  const resolvedItems = selectedItems || selectedPapers || [];

  const handleCopyMultiCite = async (style: CslStyle | 'latex' = 'apa') => {
    if (style === 'latex') {
      const keys = resolvedItems.map((p) => generateCitationKey(p)).filter(Boolean);
      const citeCmd = `\\cite{${keys.join(', ')}}`;
      await copyWithToast(citeCmd, `Copied ${citeCmd} to clipboard`);
      return;
    }

    const workspaceId = resolvedItems[0]?.workspaceId || '';
    const itemIds = resolvedItems.map((p) => p.id).filter(Boolean);
    if (workspaceId && itemIds.length > 0) {
      try {
        const res = await CitationService.batchFormat(workspaceId, itemIds, style);
        const text = res.citations
          .map((c) => c.citation?.bibliography)
          .filter(Boolean)
          .join('\n\n');
        if (text) {
          await copyWithToast(
            text,
            `Copied ${itemIds.length} citations (${style.toUpperCase()}) to clipboard`,
          );
          return;
        }
      } catch {
        // Fallback to standard citation keys
      }
    }
    const keys = resolvedItems.map((p) => generateCitationKey(p)).filter(Boolean);
    const citeCmd = `\\cite{${keys.join(', ')}}`;
    await copyWithToast(citeCmd, `Copied ${citeCmd} to clipboard`);
  };

  const handleExportAllBibtex = async () => {
    const bibtexEntries = resolvedItems.map((p) => convertToBibTeX(p)).join('\n\n');
    await copyWithToast(bibtexEntries, `Copied BibTeX for ${selectedCount} papers to clipboard`);
  };

  const handleDownloadBibFile = () => {
    const bibtexEntries = resolvedItems.map((p) => convertToBibTeX(p)).join('\n\n');
    const blob = new Blob([bibtexEntries], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `references-selected-${selectedCount}.bib`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-md select-none shadow-none"
      >
        {/* Selection Count */}
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-border">
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            <span className="font-mono tabular-nums">{selectedCount}</span> selected
          </span>
        </div>

        {/* Move To Collection Dropdown */}
        {!isTrash && onBatchMove && (
          <DropdownMenu>
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none"
                  >
                    <FolderInput className="size-3.5 text-foreground shrink-0" />
                    <span>Move to</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                Move selected items to collection
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="center"
              sideOffset={8}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-52 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-none space-y-0.5"
            >
              <DropdownMenuItem
                onClick={() => onBatchMove(null)}
                className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <Library className="size-4 text-foreground shrink-0" />
                <span>My Library</span>
              </DropdownMenuItem>
              {collections.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => onBatchMove(c.id)}
                  className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Folder className="size-4 text-foreground shrink-0" />
                  <span className="truncate">{c.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Copy Multi Citation Dropdown */}
        <DropdownMenu>
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  title="Copy citations for all selected"
                >
                  <Quote className="size-3.5 shrink-0 text-foreground" />
                  <span>Copy citation</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
              Copy formatted citations (APA, IEEE, MLA...)
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="center"
            side="top"
            sideOffset={8}
            className="w-48 p-1 bg-popover border border-border rounded-md shadow-none"
          >
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('apa')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>APA (7th Edition)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('ieee')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>IEEE Style</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('mla')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>MLA (9th Edition)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('chicago')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>Chicago (Author-Date)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('nature')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>Nature</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('harvard')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>Harvard</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('vancouver')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span>Vancouver</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('latex')}
              className="h-8 gap-2 px-2.5 text-xs cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono text-11"
            >
              <span>LaTeX (\cite&#123;...&#125;)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Copy All BibTeX */}
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportAllBibtex}
              className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
            >
              <Copy className="size-3.5 shrink-0 text-foreground" />
              <span>Copy BibTeX</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
            Copy BibTeX entries to clipboard
          </TooltipContent>
        </Tooltip>

        {/* Download .bib */}
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadBibFile}
              className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
            >
              <Download className="size-3.5 shrink-0 text-foreground" />
              <span>Download .bib</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
            Download BibTeX (.bib) file
          </TooltipContent>
        </Tooltip>

        {/* Batch Restore / Batch Move to Trash / Batch Purge */}
        {isTrash ? (
          <>
            {onBatchRestore && (
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBatchRestore}
                    className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  >
                    <RotateCcw className="size-3.5 shrink-0 text-foreground" />
                    <span>Restore</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                  Restore selected items to library
                </TooltipContent>
              </Tooltip>
            )}
            {onBatchDelete && (
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBatchDelete}
                    className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  >
                    <Trash2 className="size-3.5 shrink-0 text-foreground" />
                    <span>Delete permanently</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                  Permanently delete selected items
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          onBatchDelete && (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBatchDelete}
                  className="h-7 px-2.5 gap-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                >
                  <Trash2 className="size-3.5 shrink-0 text-foreground" />
                  <span>Move to trash</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                Move selected items to trash
              </TooltipContent>
            </Tooltip>
          )
        )}

        {/* Dismiss selection */}
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <button
              onClick={onClearSelection}
              className="flex size-6 items-center justify-center rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer ml-0.5"
              aria-label="Clear selection"
            >
              <X className="size-3.5 text-foreground shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
            Clear selection (Esc)
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </AnimatePresence>
  );
}

export default BatchBar;
export { BatchBar as ItemBatchBar };
