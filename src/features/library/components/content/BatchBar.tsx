'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput, FolderMinus, Copy, Trash2, X, Folder, Library, Quote, Download, RotateCcw, GitMerge, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui";

import { CitationService, ExportService } from '../../data';
import { generateCitationKey } from '../../domain';
import { useParams } from 'next/navigation';
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui";
import type { Collection, Item, CslStyle } from '../../types/library.types';

export interface BatchBarProps {
  selectedCount: number;
  selectedItems?: Item[];
  /** @deprecated Use selectedItems */
  selectedPapers?: Item[];
  collections: Collection[];
  onClearSelection: () => void;
  onBatchMove?: (collectionId: string | null) => void;
  onBatchDelete?: () => void;
  onBatchRestore?: () => void;
  onBatchMerge?: () => void;
  onBatchDetach?: () => void;
  isTrash?: boolean;
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
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
  onBatchMerge,
  onBatchDetach,
  isTrash = false,
  scopeId: propsScopeId,
  projectId: propsProjectId,
  workspaceId: propsWorkspaceId,
}: BatchBarProps) {
  const params = useParams() as { projectId?: string; workspaceId?: string };
  const effectiveScopeId =
    propsScopeId || propsProjectId || propsWorkspaceId || params?.projectId || 'user';

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

  const retractedSelected = resolvedItems.filter(
    (i) =>
      i.isRetracted ||
      (i as any).retractionStatus === 'retracted' ||
      (i as any).is_retracted,
  );

  const warnIfRetractedPresent = (actionLabel: string) => {
    if (retractedSelected.length > 0) {
      toast.warning(
        `Retraction Alert: ${retractedSelected.length} of ${resolvedItems.length} selected item(s) have been retracted!`,
        {
          description: `Proceeding with ${actionLabel}. Please verify validity before citing in your research.`,
          duration: 6000,
        },
      );
    }
  };

  const handleCopyMultiCite = async (style: CslStyle | 'latex' = 'apa') => {
    warnIfRetractedPresent('citation formatting');
    if (style === 'latex') {
      const keys = resolvedItems.map((p) => generateCitationKey(p)).filter(Boolean);
      const citeCmd = `\\cite{${keys.join(', ')}}`;
      await copyWithToast(citeCmd, `Copied ${citeCmd} to clipboard`);
      return;
    }

    const itemIds = resolvedItems.map((p) => p.id).filter(Boolean);
    if (itemIds.length > 0) {
      try {
        const res = await CitationService.batchFormat(effectiveScopeId, itemIds, style);
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

  const handleCopyInTextCite = async (style: CslStyle = 'apa') => {
    warnIfRetractedPresent('in-text citation');
    const itemIds = resolvedItems.map((p) => p.id).filter(Boolean);
    if (itemIds.length > 0) {
      try {
        const res = await CitationService.batchFormat(effectiveScopeId, itemIds, style);
        const inTexts = res.citations.map((c) => c.citation?.inText).filter(Boolean);
        let text = '';
        if (inTexts.every((t) => t.startsWith('(') && t.endsWith(')'))) {
          const stripped = inTexts.map((t) => t.slice(1, -1));
          text = `(${stripped.join('; ')})`;
        } else {
          text = inTexts.join('; ');
        }
        if (text) {
          await copyWithToast(text, `Copied in-text citation (${itemIds.length} items)`);
          return;
        }
      } catch {
        // Fallback
      }
    }
  };

  const handleExportAllBibtex = async () => {
    warnIfRetractedPresent('BibTeX export');
    const itemIds = resolvedItems.map((p) => p.id).filter(Boolean);
    if (itemIds.length === 0) return;

    try {
      const res = await ExportService.exportLibrary(effectiveScopeId, {
        format: 'bibtex',
        itemIds,
      });
      if (res?.content) {
        await copyWithToast(
          res.content,
          `Copied BibTeX for ${selectedCount} reference(s) to clipboard`,
        );
        return;
      }
    } catch (err) {
      console.warn('Backend BibTeX export failed', err);
    }

    const cachedBib = resolvedItems
      .map((p) => (p as any).bibtex)
      .filter((b): b is string => Boolean(b && b.trim()))
      .join('\n\n');
    if (cachedBib) {
      await copyWithToast(cachedBib, `Copied BibTeX for ${selectedCount} reference(s) to clipboard`);
    } else {
      toast.error('Unable to export BibTeX for selected items', { id: 'library-clipboard' });
    }
  };

  const handleDownloadBibFile = async () => {
    warnIfRetractedPresent('BibTeX download');
    const itemIds = resolvedItems.map((p) => p.id).filter(Boolean);
    if (itemIds.length === 0) return;

    let bibtexContent: string | null = null;
    let downloadFilename = `references-selected-${selectedCount}.bib`;

    try {
      const res = await ExportService.exportLibrary(effectiveScopeId, {
        format: 'bibtex',
        itemIds,
      });
      if (res?.content) {
        bibtexContent = res.content;
        if (res.filename) downloadFilename = res.filename;
      }
    } catch (err) {
      console.warn('Backend BibTeX export failed', err);
    }

    if (!bibtexContent) {
      bibtexContent =
        resolvedItems
          .map((p) => (p as any).bibtex)
          .filter((b): b is string => Boolean(b && b.trim()))
          .join('\n\n') || null;
    }

    if (!bibtexContent) {
      toast.error('Unable to generate BibTeX file for download', { id: 'library-clipboard' });
      return;
    }

    const blob = new Blob([bibtexContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFilename;
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
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-md select-none shadow-raised-200"
      >
        {/* Selection Count */}
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-border">
          <span className="text-12 font-medium text-foreground whitespace-nowrap">
            <span className="font-mono tabular-nums">{selectedCount}</span> selected
          </span>
          {retractedSelected.length > 0 && (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-10 font-medium bg-destructive/10 text-destructive rounded-md border border-destructive/30 cursor-help">
                  <ShieldAlert className="size-3 text-destructive shrink-0" strokeWidth={1.5} />
                  <span>{retractedSelected.length} retracted</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-1 rounded-md border border-destructive/30 bg-popover text-foreground shadow-xs">
                Warning: {retractedSelected.length} selected item(s) have retraction notices
              </TooltipContent>
            </Tooltip>
          )}
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
                    className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none"
                  >
                    <FolderInput className="size-3.5 text-foreground shrink-0" />
                    <span>Move to</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                Move to collection
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="center"
              sideOffset={8}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5"
            >
              <DropdownMenuItem
                onClick={() => onBatchMove(null)}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>My Library</span>
              </DropdownMenuItem>
              {collections.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => onBatchMove(c.id)}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{c.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Merge Duplicates Button - Contextual: only visible when onBatchMerge is provided and selectedCount >= 2 */}
        {!isTrash && onBatchMerge && selectedCount >= 2 && (
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBatchMerge}
                className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
              >
                <GitMerge className="size-3.5 shrink-0 text-foreground" />
                <span>Merge {selectedCount} items</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
              Merge items
            </TooltipContent>
          </Tooltip>
        )}

        {/* Copy Multi Citation Dropdown */}
        <DropdownMenu>
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  aria-label="Copy citation"
                >
                  <Quote className="size-3.5 shrink-0 text-foreground" />
                  <span>Copy citation</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
              Copy citation
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="center"
            side="top"
            sideOffset={8}
            className="w-56 p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200"
          >
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('apa')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>APA (7th Edition)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('ieee')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>IEEE Style</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('mla')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>MLA (9th Edition)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('chicago')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>Chicago (Author-Date)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('nature')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>Nature</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('harvard')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>Harvard</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('vancouver')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>Vancouver</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCopyMultiCite('latex')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors font-mono text-11"
            >
              <span>LaTeX (\cite&#123;...&#125;)</span>
            </DropdownMenuItem>
            <div className="h-px my-1 bg-border" />
            <DropdownMenuItem
              onClick={() => handleCopyInTextCite('apa')}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-primary font-medium rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <span>In-Text Citation (e.g. Smith et al., 2023)</span>
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
              className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
            >
              <Copy className="size-3.5 shrink-0 text-foreground" />
              <span>Copy BibTeX</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
            Copy BibTeX
          </TooltipContent>
        </Tooltip>

        {/* Download .bib */}
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadBibFile}
              className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
            >
              <Download className="size-3.5 shrink-0 text-foreground" />
              <span>Download .bib</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
            Download BibTeX
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
                    className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  >
                    <RotateCcw className="size-3.5 shrink-0 text-foreground" />
                    <span>Restore</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                  Restore
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
                    className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  >
                    <Trash2 className="size-3.5 shrink-0 text-foreground" />
                    <span>Delete permanently</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                  Delete permanently
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <>
            {onBatchDetach && (
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBatchDetach}
                    className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  >
                    <FolderMinus className="size-3.5 shrink-0 text-foreground" />
                    <span>Remove from collection</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                  Remove from collection (keep in library)
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
                    className="h-7 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center"
                  >
                    <Trash2 className="size-3.5 shrink-0 text-foreground" />
                    <span>Move to trash</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground">
                  Move to trash
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}

        {/* Dismiss selection */}
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <button
              onClick={onClearSelection}
              className="flex size-6 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer ml-0.5"
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
