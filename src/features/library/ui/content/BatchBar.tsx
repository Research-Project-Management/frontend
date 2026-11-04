'use client';

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, FolderSync, Users, ChevronRight, Folder, Files } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useParams } from 'next/navigation';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import type { Collection, CslStyle, Item, CollectionActionHandlers, LibraryScope, ProjectRole } from '@/features/library/domain/types/core.types';
import { useLibraryBatchCoordinator, hasItemPdfOrAttachment } from '@/features/library/core/coordinator/batch-action.coordinator';
import { executeCopyMultiCite, executeCopyInTextCite, executeExportAllBibtex, executeDownloadBibFile } from '@/features/library/core/coordinator/citation-export.coordinator';
import { useBatchRenameAttachmentsMutation, useCitationStyles } from '@/features/library/sdk/queries/extraction.queries';
import { formatCitationStyleLabel } from '@/features/library/domain/citations';
import { BatchMoveCollectionPopover, BatchCitationExportPopovers, BatchSmartViewActions, BatchLifecycleActions } from '@/features/library/ui/content/BatchBarPopovers';
import { cn } from '@/shared/lib/utils';
import { useLibraryCacheSynchronizer } from '@/features/library/sdk/queries/catalog.queries';
import type { TreeNode } from '@/features/library/domain/collection-tree';
import type { SavedSearch } from '@/features/library/domain/types/ingestion.types';
import { CollectionTree } from '@/features/library/ui/sidebar/CollectionTree';
import { SidebarNavItem } from '@/features/library/ui/sidebar/SidebarSystemNav';
import { SavedSearchListSection } from '@/features/library/ui/sidebar/FeedsListSection';
import { getLibraryPermissions } from '@/features/library/domain/library-permissions.policy';

export type BatchActionCoordinator = ReturnType<typeof useLibraryBatchCoordinator>;

export interface BatchBarProps {
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
    Boolean(onBatchMove) &&
    (targetableCollections.length > 0 || canMoveToRootUnfiled);

  const selectedItemsWithFilesIds = useMemo(
    () =>
      coordinatorFileIds ??
      resolvedItems
        .filter((it) => !it._isProcessing && hasItemPdfOrAttachment(it))
        .map((it) => it.id)
        .filter(Boolean),
    [coordinatorFileIds, resolvedItems],
  );

  const showRenamePdfs =
    Boolean(onBatchMove) && selectedItemsWithFilesIds.length > 0;

  const { data: serverStyles = [] } = useCitationStyles(effectiveScopeId, {
    enabled: !effectiveIsTrash && selectedCount > 0,
  });
  const batchRenameMutation = useBatchRenameAttachmentsMutation(effectiveScopeId);

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

          {/* Batch Rename Attachments from Parent Metadata — Only when selected items actually have PDF/file attachments */}
          {showRenamePdfs && (
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
                      itemIds: selectedItemsWithFilesIds,
                    })
                  }
                  className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                >
                  <FolderSync className="size-3.5 shrink-0 text-foreground" />
                  <span>Rename PDFs</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Rename attached files from parent metadata ({selectedItemsWithFilesIds.length} with files)
              </TooltipContent>
            </Tooltip>
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

export interface ProjectLike {
  id: string;
  name?: string;
  role?: string;
  yourRole?: string;
  permissions?: Partial<import('@/features/library/domain/types/core.types').LibraryPermissions> | string[] | Record<string, unknown>;
  effectivePermissions?: string[];
  [key: string]: unknown;
}

interface ProjectLibrariesSectionProps extends CollectionActionHandlers {
  projects: ProjectLike[];
  activeScope: LibraryScope;
  currentUserId?: string;
  basePath: string;
  navId: string;
  projectTree: TreeNode[];
  projectCollections: Collection[];
  savedSearches?: SavedSearch[] | Array<{ id: string; name: string }>;
  currentSavedSearchId?: string | null;
  currentFilter?: string | null;
  activeId: string | string[] | null;
  isSearching: boolean;
  searchQuery: string;
  renamingId: string | null;
  renameValue: string;
  canManageCollections?: boolean;
  onSelectProject: (scope: LibraryScope) => void;
  onEditSavedSearch?: (savedSearch: SavedSearch) => void;
  onStartRenameSavedSearch?: (id: string, name: string) => void;
  onSubmitRenameSavedSearch?: (id: string) => void;
  onRenameSavedSearchValueChange?: (value: string) => void;
  onDuplicateSavedSearch?: (savedSearch: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
  pathname?: string;
  renamingSavedSearchId?: string | null;
  renameSavedSearchValue?: string;
}

/**
 * Reads the Backend-authoritative role ('yourRole' | 'role') provided on the project summary DTO.
 * Never guesses roles by inspecting ownerId/createdById/members[] on the client.
 */
export function resolveProjectRole(
  project: ProjectLike | null | undefined,
  _currentUserId?: string,
): ProjectRole {
  if (!project) return 'reviewer';

  const rawServerRole = project.yourRole || project.role;
  if (rawServerRole) {
    const norm = String(rawServerRole).trim().toLowerCase();
    if (norm === 'owner') return 'owner';
    if (norm === 'coordinator') return 'coordinator';
    if (norm === 'contributor') return 'contributor';
    if (norm === 'reviewer') return 'reviewer';
  }

  return 'reviewer';
}

export function ProjectLibrariesSection({
  projects,
  activeScope,
  currentUserId,
  basePath,
  navId,
  projectTree,
  projectCollections,
  savedSearches,
  currentSavedSearchId,
  currentFilter,
  activeId,
  isSearching,
  searchQuery,
  renamingId,
  renameValue,
  canManageCollections: propCanManageCollections,
  onSelectProject,
  onStartRename,
  onSubmitRename,
  onRenameValueChange,
  onDelete,
  onDeleteWithItems,
  onMove,
  onCopy,
  onCreateSub,
  onExportBibtex,
  onExportBundle,
  onLinkClick,
  onDropItems,
  onEditSavedSearch,
  onStartRenameSavedSearch,
  onSubmitRenameSavedSearch,
  onRenameSavedSearchValueChange,
  onDuplicateSavedSearch,
  onDeleteSavedSearch,
  renamingSavedSearchId,
  renameSavedSearchValue = '',
  pathname = '',
}: ProjectLibrariesSectionProps) {
  const { prefetchProjectScope } = useLibraryCacheSynchronizer(activeScope.id);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      <div className="relative group/root flex items-center w-full">
        <button
          type="button"
          onClick={() => setIsProjectsExpanded((v) => !v)}
          className={cn(
            "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8 cursor-pointer text-left",
            activeScope.type === 'project'
              ? "bg-muted text-foreground font-medium"
              : "text-foreground hover:bg-muted group-hover/root:bg-muted font-normal"
          )}
        >
          <Users className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
            Project Libraries
          </span>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsProjectsExpanded((v) => !v);
              }}
              aria-label={isProjectsExpanded ? 'Collapse Project Libraries' : 'Expand Project Libraries'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform duration-150 shrink-0',
                  isProjectsExpanded && 'rotate-90'
                )}
                strokeWidth={1.5}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={6}
            alignOffset={2}
          >
            {isProjectsExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {isProjectsExpanded && (
        <div className="flex flex-col gap-0.5 w-full">
          {projects.length === 0 ? (
            <div className="pl-6 pr-2.5 py-1.5 text-11 text-muted-foreground italic select-none">
              No project libraries
            </div>
          ) : (
            projects.map((project) => {
              const isProjectActive =
                activeScope.type === 'project' && activeScope.id === project.id;
              const projectCanManageCollections =
                propCanManageCollections !== undefined
                  ? propCanManageCollections
                  : isProjectActive && getLibraryPermissions(activeScope).canManageCollections;

              return (
                <div key={project.id} className="flex flex-col gap-0.5 w-full">
                  <button
                    type="button"
                    onMouseEnter={() => prefetchProjectScope(project.id)}
                    onFocus={() => prefetchProjectScope(project.id)}
                    onClick={() => {
                      const role = resolveProjectRole(project, currentUserId);
                      onSelectProject({
                        type: 'project',
                        id: project.id,
                        projectId: project.id,
                        name: project.name || '',
                        role,
                        ...(project.permissions ? { permissions: project.permissions } : {}),
                        ...(project.effectivePermissions
                          ? { effectivePermissions: project.effectivePermissions }
                          : {}),
                      });
                    }}
                    className={cn(
                      "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 transition-colors outline-none select-none text-left cursor-pointer",
                      isProjectActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted has-[[data-state=open]]:bg-muted font-normal",
                    )}
                  >
                    <Folder className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                    <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
                      {project.name}
                    </span>
                  </button>

                  {/* Project Contents (Rendered when this project is active) */}
                  {isProjectActive && (
                    <div className="flex flex-col gap-0.5 w-full">
                      {projectTree.length > 0 && (
                        <CollectionTree
                          tree={projectTree}
                          allCollections={projectCollections}
                          basePath={basePath}
                          activeId={activeId}
                          navId={navId}
                          renamingId={renamingId}
                          renameValue={renameValue}
                          isSearching={isSearching}
                          searchQuery={searchQuery}
                          canManageCollections={projectCanManageCollections}
                          onStartRename={onStartRename}
                          onSubmitRename={onSubmitRename}
                          onRenameValueChange={onRenameValueChange}
                          onDelete={onDelete}
                          onDeleteWithItems={onDeleteWithItems}
                          onMove={onMove}
                          onCopy={onCopy}
                          onCreateSub={onCreateSub}
                          onExportBibtex={onExportBibtex}
                          onExportBundle={onExportBundle}
                          onLinkClick={onLinkClick}
                          onDropItems={onDropItems}
                        />
                      )}

                      <SavedSearchListSection
                        savedSearches={savedSearches as SavedSearch[] | undefined}
                        basePath={basePath}
                        navId={navId}
                        currentFilter={currentFilter ?? null}
                        currentSavedSearchId={currentSavedSearchId}
                        isActiveScope={isProjectActive}
                        onItemClick={onLinkClick}
                        onEditSavedSearch={onEditSavedSearch}
                        onStartRenameSavedSearch={onStartRenameSavedSearch}
                        onSubmitRenameSavedSearch={onSubmitRenameSavedSearch}
                        onRenameSavedSearchValueChange={onRenameSavedSearchValueChange}
                        onDuplicateSavedSearch={onDuplicateSavedSearch}
                        onDeleteSavedSearch={onDeleteSavedSearch}
                        renamingSavedSearchId={renamingSavedSearchId}
                        renameSavedSearchValue={renameSavedSearchValue}
                      />

                      {/* Project Duplicate Items Nav Item */}
                      <div className="flex flex-col gap-0.5 w-full">
                        <SidebarNavItem
                          href={`${basePath}/duplicates`}
                          icon={Files}
                          label="Duplicate Items"
                          isActive={pathname === `${basePath}/duplicates` || (pathname === basePath && currentFilter === 'duplicates')}
                          navId={navId}
                          onClick={onLinkClick}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
