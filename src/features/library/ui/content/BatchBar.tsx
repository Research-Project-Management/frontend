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
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/shared/lib/utils";
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
  Item,
  CslStyle,
} from "@/features/library/domain/types/library.types";
import { isItemRetracted } from "@/features/library/domain/retraction";
import {
  useLibraryBatchCoordinator,
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
  executeDownloadBibFile,
} from "@/features/library/core/coordinator/batch-action.coordinator";

export interface BatchBarProps {
  coordinator?: ReturnType<typeof useLibraryBatchCoordinator>;
  items?: Item[];
  collectionId?: string;
  view?: string;
  canEdit?: boolean;
  selectedCount?: number;
  selectedItems?: Item[];
  collections: Collection[];
  onClearSelection?: () => void;
  onBatchMove?: (collectionId: string | null) => void;
  onBatchDelete?: () => void;
  onBatchRestore?: () => void;
  onBatchMerge?: () => void;
  onBatchDetach?: () => void;
  isTrash?: boolean;
  scopeId?: string;
  projectId?: string;
}

export function BatchBar({
  coordinator: propCoordinator,
  items,
  collectionId,
  view,
  canEdit = true,
  selectedCount: propSelectedCount,
  selectedItems: propSelectedItems,
  collections,
  onClearSelection: propOnClearSelection,
  onBatchMove: propOnBatchMove,
  onBatchDelete: propOnBatchDelete,
  onBatchRestore: propOnBatchRestore,
  onBatchMerge: propOnBatchMerge,
  onBatchDetach: propOnBatchDetach,
  isTrash = false,
  scopeId: propsScopeId,
  projectId: propsProjectId,
}: BatchBarProps) {
  const params = useParams() as { projectId?: string };
  const effectiveScopeId =
    propsScopeId || propsProjectId || params?.projectId || "user";

  const internalCoordinator = useLibraryBatchCoordinator({
    items,
    scopeId: effectiveScopeId,
    collectionId,
    view,
    isTrash,
    canEdit,
  });

  // Use explicit coordinator or fallback to internal coordinator when items are provided
  const coordinator =
    propCoordinator ?? (items !== undefined ? internalCoordinator : undefined);

  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isProjectScope = activeScope.type === "project";
  const rootLibraryName = isProjectScope
    ? activeScope.name || "Project"
    : "My Library";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedCount = coordinator
    ? coordinator.selectedCount
    : (propSelectedCount ?? 0);
  const resolvedItems = coordinator
    ? coordinator.selectedItems
    : (propSelectedItems ?? []);
  const onClearSelection = coordinator
    ? coordinator.clearSelection
    : propOnClearSelection;
  const onBatchMove = coordinator ? coordinator.batchMove : propOnBatchMove;
  const onBatchDelete = coordinator
    ? coordinator.batchDelete
    : propOnBatchDelete;
  const onBatchRestore = coordinator
    ? coordinator.batchRestore
    : propOnBatchRestore;
  const onBatchDetach = coordinator
    ? coordinator.batchDetach
    : propOnBatchDetach;
  const onBatchMerge = coordinator ? coordinator.batchMerge : propOnBatchMerge;

  React.useEffect(() => {
    if (coordinator || selectedCount === 0 || !onClearSelection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [coordinator, selectedCount, onClearSelection]);

  if (selectedCount === 0) return null;

  const isAllProcessingSelected = coordinator
    ? coordinator.isAllProcessingSelected
    : resolvedItems.length > 0 &&
      resolvedItems.every(
        (item: Item) =>
          Boolean(item._isProcessing) ||
          item.id.startsWith("temp-") ||
          item.id.startsWith("provisional-"),
      );

  const retractedSelected = coordinator
    ? coordinator.retractedSelected
    : resolvedItems.filter((i: Item) => isItemRetracted(i));

  const handleCopyMultiCite = coordinator
    ? coordinator.copyMultiCite
    : (style: CslStyle | "latex" = "apa") =>
        executeCopyMultiCite(
          resolvedItems,
          effectiveScopeId,
          style,
          retractedSelected.length,
        );

  const handleCopyInTextCite = coordinator
    ? coordinator.copyInTextCite
    : (style: CslStyle = "apa") =>
        executeCopyInTextCite(
          resolvedItems,
          effectiveScopeId,
          style,
          retractedSelected.length,
        );

  const handleExportAllBibtex = coordinator
    ? coordinator.exportAllBibtex
    : () =>
        executeExportAllBibtex(
          resolvedItems,
          effectiveScopeId,
          selectedCount,
          retractedSelected.length,
        );

  const handleDownloadBibFile = coordinator
    ? coordinator.downloadBibFile
    : () =>
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
                  {isAllProcessingSelected
                    ? "Cannot move files while uploading or processing"
                    : "Move to collection"}
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
                {isAllProcessingSelected
                  ? "Cannot merge files while uploading or processing"
                  : "Merge items"}
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
              className="w-56 p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200"
            >
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("apa")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>APA (7th Edition)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("ieee")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>IEEE Style</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("mla")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>MLA (9th Edition)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("chicago")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>Chicago (Author-Date)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("nature")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>Nature</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("harvard")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>Harvard</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("vancouver")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>Vancouver</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyMultiCite("latex")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors font-mono text-11"
              >
                <span>LaTeX (\cite&#123;...&#125;)</span>
              </DropdownMenuItem>
              <div className="h-px my-1 bg-border" />
              <DropdownMenuItem
                onClick={() => handleCopyInTextCite("apa")}
                className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-primary font-medium rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <span>In-Text Citation (e.g. Smith et al., 2023)</span>
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

          {/* Download .bib */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadBibFile}
                className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
              >
                <Download className="size-3.5 shrink-0 text-foreground" />
                <span>Download .bib</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              Download BibTeX
            </TooltipContent>
          </Tooltip>

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
                    {isAllProcessingSelected
                      ? "Cannot restore files while uploading or processing"
                      : "Restore"}
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
                    {isAllProcessingSelected
                      ? "Cannot delete files while uploading or processing"
                      : "Delete permanently"}
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
                    {isAllProcessingSelected
                      ? "Cannot remove files while uploading or processing"
                      : "Remove from collection (keep in library)"}
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
                    {isAllProcessingSelected
                      ? "Cannot delete files while uploading or processing"
                      : "Move to trash"}
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
