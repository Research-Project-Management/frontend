"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderInput,
  FolderMinus,
  Copy,
  Trash2,
  X,
  Folder,
  Library,
  Quote,
  Download,
  RotateCcw,
  GitMerge,
  ShieldAlert,
  FolderSync,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";

import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import { useParams } from "next/navigation";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import type {
  Collection,
  CslStyle,
} from "@/features/library/domain/types/library.types";
import {
  useLibraryBatchCoordinator,
} from "@/features/library/core/coordinator/batch-action.coordinator";
import {
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
  executeDownloadBibFile,
  executeDownloadFormatFile,
} from "@/features/library/core/coordinator/citation-export.coordinator";
import { useBatchRenameAttachmentsMutation } from "@/features/library/sdk/queries/extraction.queries";
import { useCitationStyles } from "@/features/library/sdk/queries/citation.queries";
import { formatCitationStyleLabel } from "@/features/library/domain/citations";

export type BatchActionCoordinator = ReturnType<typeof useLibraryBatchCoordinator>;

export interface BatchBarProps {
  coordinator?: BatchActionCoordinator;
  items?: import('@/features/library/domain/types/library.types').Item[];
  collectionId?: string | null;
  view?: string;
  collections: Collection[];
  isTrash?: boolean;
  scopeId?: string;
  canEdit?: boolean;
}

export function BatchBar({
  coordinator: externalCoordinator,
  items = [],
  collectionId,
  view,
  collections,
  isTrash = false,
  scopeId: propsScopeId,
  canEdit = true,
}: BatchBarProps) {
  const params = useParams() as { projectId?: string };
  const effectiveScopeId =
    propsScopeId || params?.projectId || "user";

  const internalCoordinator = useLibraryBatchCoordinator({
    items,
    scopeId: effectiveScopeId,
    collectionId: collectionId || undefined,
    view,
    isTrash,
    canEdit,
  });

  const coordinator = externalCoordinator || internalCoordinator;

  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isProjectScope = activeScope.type === "project";
  const rootLibraryName = isProjectScope
    ? activeScope.name || "Project"
    : "My Library";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    selectedCount,
    selectedItems: resolvedItems,
    clearSelection: onClearSelection,
    batchMove: onBatchMove,
    batchDelete: onBatchDelete,
    batchRestore: onBatchRestore,
    batchDetach: onBatchDetach,
    batchMerge: onBatchMerge,
    isAllProcessingSelected,
    retractedSelected,
  } = coordinator;

  const { data: serverStyles = [] } = useCitationStyles(effectiveScopeId);
  const batchRenameMutation = useBatchRenameAttachmentsMutation(effectiveScopeId);

  const citationStyles = React.useMemo(() => {
    return (serverStyles || [])
      .filter(
        (s) =>
          s.id !== "bibtex" &&
          s.id !== "ris" &&
          s.id !== "auto" &&
          s.id !== "auto-numeric",
      )
      .map((s) => ({
        id: s.id,
        label: formatCitationStyleLabel(s),
      }));
  }, [serverStyles]);

  if (selectedCount === 0) return null;

  const handleCopyMultiCite = (style: CslStyle | "latex" = "apa") =>
    executeCopyMultiCite(
      resolvedItems,
      effectiveScopeId,
      style,
      retractedSelected.length,
    );

  const handleCopyInTextCite = (style: CslStyle = "apa") =>
    executeCopyInTextCite(
      resolvedItems,
      effectiveScopeId,
      style,
      retractedSelected.length,
    );

  const handleExportAllBibtex = () =>
    executeExportAllBibtex(
      resolvedItems,
      effectiveScopeId,
      selectedCount,
      retractedSelected.length,
    );

  const handleDownloadBibFile = () =>
    executeDownloadBibFile(
      resolvedItems,
      effectiveScopeId,
      selectedCount,
      retractedSelected.length,
    );

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          key="batch-selection-bar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-md select-none shadow-raised-200 max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none"
        >
          {/* Selection Count */}
          <div className="flex items-center gap-1.5 pr-2.5 border-r border-border">
            <span className="text-12 font-medium text-foreground whitespace-nowrap">
              <span className="font-mono tabular-nums">{selectedCount}</span>{" "}
              selected
            </span>
            {retractedSelected.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-10 font-medium bg-destructive/10 text-destructive rounded-md border border-destructive/30 cursor-help">
                    <ShieldAlert
                      className="size-3 text-destructive shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>{retractedSelected.length} retracted</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  Warning: {retractedSelected.length} selected item(s) have
                  retraction notices
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Move To Collection Dropdown */}
          {!isTrash && onBatchMove && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isAllProcessingSelected}
                      className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none relative before:absolute before:-inset-1 md:before:hidden"
                    >
                      <FolderInput className="size-3.5 text-foreground shrink-0" />
                      <span>Move to</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  Move to
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
                  {isProjectScope ? (
                    <Folder
                      className="size-4 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Library
                      className="size-4 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                  )}
                  <span>{rootLibraryName}</span>
                </DropdownMenuItem>
                {collections.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => onBatchMove(c.id)}
                    className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <Folder
                      className="size-4 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Merge Duplicates Button - Contextual: only visible when onBatchMerge is provided and selectedCount >= 2 */}
          {!isTrash && onBatchMerge && selectedCount >= 2 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isAllProcessingSelected}
                  onClick={onBatchMerge}
                  className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                >
                  <GitMerge className="size-3.5 shrink-0 text-foreground" />
                  <span>Merge {selectedCount} items</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Merge items
              </TooltipContent>
            </Tooltip>
          )}

          {/* Copy Multi Citation Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                    aria-label="Copy citation"
                  >
                    <Quote className="size-3.5 shrink-0 text-foreground" />
                    <span>Copy citation</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Copy citation
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="center"
              side="top"
              sideOffset={8}
              className="w-auto min-w-[240px] max-w-[320px] p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200"
            >
              {citationStyles.map((style) => (
                <DropdownMenuItem
                  key={style.id}
                  onClick={() => handleCopyMultiCite(style.id as CslStyle)}
                  className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors whitespace-nowrap"
                >
                  <span>{style.label}</span>
                </DropdownMenuItem>
              ))}

              <div className="-mx-1.5 h-px my-1 bg-border" />

              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("latex")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors whitespace-nowrap font-mono text-11"
              >
                <span>LaTeX \cite</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleCopyInTextCite("apa")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors whitespace-nowrap"
              >
                <span>In-Text Citation</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy All BibTeX */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportAllBibtex}
                className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
              >
                <Copy className="size-3.5 shrink-0 text-foreground" />
                <span>Copy BibTeX</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              Copy BibTeX
            </TooltipContent>
          </Tooltip>

          {/* Export Dropdown (.bib, .ris, .json, .csv, .md) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                  >
                    <Download className="size-3.5 shrink-0 text-foreground" />
                    <span>Export</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Export selected references
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="center"
              side="top"
              sideOffset={8}
              className="w-48 p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200"
            >
              <DropdownMenuItem
                onClick={handleDownloadBibFile}
                className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                <span>BibTeX (.bib)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void executeDownloadFormatFile(
                    resolvedItems,
                    effectiveScopeId,
                    "ris",
                    retractedSelected.length,
                  )
                }
                className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                <span>RIS (.ris)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void executeDownloadFormatFile(
                    resolvedItems,
                    effectiveScopeId,
                    "csl_json",
                    retractedSelected.length,
                  )
                }
                className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                <span>CSL-JSON (.json)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void executeDownloadFormatFile(
                    resolvedItems,
                    effectiveScopeId,
                    "csv",
                    retractedSelected.length,
                  )
                }
                className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                <span>CSV Table (.csv)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void executeDownloadFormatFile(
                    resolvedItems,
                    effectiveScopeId,
                    "markdown",
                    retractedSelected.length,
                  )
                }
                className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                <span>Markdown (.md)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Batch Rename Attachments from Parent Metadata */}
          {!isTrash && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    isAllProcessingSelected || batchRenameMutation.isPending
                  }
                  onClick={() =>
                    void batchRenameMutation.mutateAsync({
                      itemIds: resolvedItems.map((it) => it.id).filter(Boolean),
                    })
                  }
                  className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                >
                  <FolderSync className="size-3.5 shrink-0 text-foreground" />
                  <span>Rename PDFs</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Rename attached files from parent metadata
              </TooltipContent>
            </Tooltip>
          )}

          {/* Batch Restore / Batch Move to Trash / Batch Purge */}
          {isTrash ? (
            <>
              {onBatchRestore && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isAllProcessingSelected}
                      onClick={onBatchRestore}
                      className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                    >
                      <RotateCcw className="size-3.5 shrink-0 text-foreground" />
                      <span>Restore</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Restore
                  </TooltipContent>
                </Tooltip>
              )}
              {onBatchDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isAllProcessingSelected}
                      onClick={onBatchDelete}
                      className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                    >
                      <Trash2 className="size-3.5 shrink-0 text-foreground" />
                      <span>Delete permanently</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Delete permanently
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              {onBatchDetach && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isAllProcessingSelected}
                      onClick={() => onBatchDetach()}
                      className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                    >
                      <FolderMinus className="size-3.5 shrink-0 text-foreground" />
                      <span>Remove from collection</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Remove from collection
                  </TooltipContent>
                </Tooltip>
              )}
              {onBatchDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isAllProcessingSelected}
                      onClick={onBatchDelete}
                      className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                    >
                      <Trash2 className="size-3.5 shrink-0 text-foreground" />
                      <span>Move to trash</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Move to trash
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}

          {/* Dismiss selection */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClearSelection}
                className="flex size-6 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer ml-0.5 outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2 md:before:hidden"
                aria-label="Clear selection"
              >
                <X className="size-3.5 text-foreground shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              Clear selection (Esc)
            </TooltipContent>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default BatchBar;
