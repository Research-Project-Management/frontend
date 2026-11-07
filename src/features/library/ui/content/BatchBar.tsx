'use client';

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, FileEdit } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useParams } from 'next/navigation';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import type { Collection, CslStyle, Item } from '@/features/library/types/core.types';
import { useLibraryBatchCoordinator } from '@/features/library/core/coordinator/batch-action.coordinator';
import { executeCopyMultiCite, executeCopyInTextCite, executeExportAllBibtex, executeDownloadBibFile } from '@/features/library/core/coordinator/citation-export.coordinator';
import { useCitationStyles } from '@/features/library/core/coordinator/citation-export.coordinator';
import { useBatchRenameAttachmentsMutation } from '@/features/library/core/coordinator/item-action.coordinator';
import { formatCitationStyleLabel } from '@/features/library/domain/citations.domain';
import { BatchMoveCollectionPopover, BatchCitationExportPopovers, BatchSmartViewActions, BatchLifecycleActions } from '@/features/library/ui/content/BatchBarPopovers';

type BatchActionCoordinator = ReturnType<typeof useLibraryBatchCoordinator>;

interface BatchBarProps {
  coordinator?: BatchActionCoordinator;
  items?: Item[];
  collectionId?: string | null;
  view?: string;
  collections: Collection[];
  isTrash?: boolean;
  scopeId?: string;
  canEdit?: boolean;
}

const EXCLUDED_CITATION_STYLE_IDS = new Set([
  "bibtex",
  "ris",
  "auto",
  "auto-numeric",
]);

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
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isProjectScope = activeScope.type === "project";
  const effectiveScopeId =
    propsScopeId ||
    params?.projectId ||
    (isProjectScope && activeScope.id ? activeScope.id : "user");

  const internalCoordinator = useLibraryBatchCoordinator({
    items,
    scopeId: effectiveScopeId,
    collectionId: collectionId || undefined,
    view,
    isTrash,
    canEdit,
  });

  const coordinator = externalCoordinator || internalCoordinator;

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
    selectedItemsWithFilesIds: coordinatorFileIds,
    clearSelection: onClearSelection,
    batchMove: onBatchMove,
    batchAssign: onBatchAssign,
    batchDelete: onBatchDelete,
    batchRestore: onBatchRestore,
    batchDetach: onBatchDetach,
    batchMerge: onBatchMerge,
    batchUnstar: onBatchUnstar,
    batchRemoveFromMyPublications: onBatchRemoveFromMyPublications,
    batchRecheckRetraction: onBatchRecheckRetraction,
    batchClearRetractionFlags: onBatchClearRetractionFlags,
    isCheckingRetraction,
    isUnflaggingRetraction,
    isAllProcessingSelected,
    retractedSelected,
  } = coordinator;

  const effectiveView = view ?? coordinator.view;
  const effectiveIsTrash = Boolean(isTrash || effectiveView === "trash" || coordinator.isTrash);
  const isDuplicatesView = effectiveView === "duplicates";
  const isUnfiledView = effectiveView === "unfiled";
  const isStarredView = effectiveView === "starred";
  const isMyPublicationsView = effectiveView === "my-publications";
  const isRetractedView = effectiveView === "retracted";

  // Target collections available for Move To in the current page context:
  // - Inside a collection: exclude the current collection itself.
  // - Root / Smart views: all collections.
  const targetableCollections = useMemo(
    () =>
      collectionId
        ? collections.filter((c) => c.id !== collectionId)
        : collections,
    [collections, collectionId],
  );

  // Whether "Move to > Root (My Library / Unfile)" is meaningful on the current page:
  const canMoveToRootUnfiled = useMemo(
    () =>
      Boolean(onBatchMove) &&
      !isUnfiledView &&
      (Boolean(collectionId) ||
        resolvedItems.some(
          (it) => Array.isArray(it.collectionIds) && it.collectionIds.length > 0,
        )),
    [onBatchMove, isUnfiledView, collectionId, resolvedItems],
  );

  const showMoveDropdown =
    Boolean(onBatchMove || onBatchAssign) &&
    targetableCollections.length > 0;

  const { data: serverStyles = [] } = useCitationStyles(effectiveScopeId, {
    enabled: !effectiveIsTrash && selectedCount > 0,
  });

  const citationStyles = useMemo(
    () =>
      (serverStyles || [])
        .filter((s) => !EXCLUDED_CITATION_STYLE_IDS.has(s.id))
        .map((s) => ({
          id: s.id,
          label: formatCitationStyleLabel(s),
        })),
    [serverStyles],
  );

  const renameMutation = useBatchRenameAttachmentsMutation(effectiveScopeId);

  if (selectedCount === 0) return null;

  const handleBatchRenamePdfs = async () => {
    if (coordinatorFileIds.length === 0) return;
    try {
      await renameMutation.mutateAsync({ itemIds: coordinatorFileIds });
    } catch {
      // Handled
    }
  };

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
            {!effectiveIsTrash && retractedSelected.length > 0 && (
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

          {/* Move To / Add To Collection Dropdowns (Non-Trash, Non-Duplicates, Editable) */}
          {showMoveDropdown && onBatchMove && (
            <BatchMoveCollectionPopover
              isUnfiledView={isUnfiledView}
              isAllProcessingSelected={isAllProcessingSelected}
              canMoveToRootUnfiled={canMoveToRootUnfiled}
              isProjectScope={isProjectScope}
              rootLibraryName={rootLibraryName}
              targetableCollections={targetableCollections}
              allCollections={collections}
              onBatchMove={onBatchMove}
              onBatchAssign={onBatchAssign}
            />
          )}

          {/* Smart Views Contextual Actions */}
          <BatchSmartViewActions
            effectiveIsTrash={effectiveIsTrash}
            isDuplicatesView={isDuplicatesView}
            isStarredView={isStarredView}
            isMyPublicationsView={isMyPublicationsView}
            isRetractedView={isRetractedView}
            canEdit={canEdit}
            selectedCount={selectedCount}
            isAllProcessingSelected={isAllProcessingSelected}
            isCheckingRetraction={isCheckingRetraction}
            isUnflaggingRetraction={isUnflaggingRetraction}
            onBatchMerge={onBatchMerge}
            onBatchUnstar={onBatchUnstar}
            onBatchRemoveFromMyPublications={onBatchRemoveFromMyPublications}
            onBatchRecheckRetraction={onBatchRecheckRetraction}
            onBatchClearRetractionFlags={onBatchClearRetractionFlags}
          />

          {/* Batch Rename PDFs (Only when selected items have attachments and not trash) */}
          {canEdit && !effectiveIsTrash && coordinatorFileIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected || renameMutation.isPending}
              onClick={handleBatchRenamePdfs}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
            >
              <FileEdit className="size-3.5 shrink-0 text-foreground" />
              <span>Rename PDFs</span>
            </Button>
          )}

          {/* Citation & Export Actions — Hidden on Trash page */}
          {!effectiveIsTrash && (
            <BatchCitationExportPopovers
              citationStyles={citationStyles}
              resolvedItems={resolvedItems}
              effectiveScopeId={effectiveScopeId}
              retractedCount={retractedSelected.length}
              onCopyMultiCite={(style) => void handleCopyMultiCite(style)}
              onCopyInTextCite={(style) => void handleCopyInTextCite(style)}
              onExportAllBibtex={() => void handleExportAllBibtex()}
              onDownloadBibFile={() => void handleDownloadBibFile()}
            />
          )}

          {/* Batch Restore / Batch Move to Trash / Batch Purge */}
          <BatchLifecycleActions
            effectiveIsTrash={effectiveIsTrash}
            canEdit={canEdit}
            isAllProcessingSelected={isAllProcessingSelected}
            onBatchRestore={onBatchRestore}
            onBatchDelete={onBatchDelete}
            onBatchDetach={onBatchDetach}
          />

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
